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
        
        try {
            // 移动端强制请求 16kHz 采样率，桌面端也尝试请求
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            
            // 检测浏览器支持的音频 MIME 类型，优先使用兼容性更好的格式
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
            console.log('[VoiceHandler] 使用音频格式:', mimeType || '浏览器默认');
            
            const recorderOptions = {};
            if (mimeType) recorderOptions.mimeType = mimeType;
            this.mediaRecorder = new MediaRecorder(stream, recorderOptions);
            this._recordingMimeType = mimeType || 'audio/webm';
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
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start();
            
            // 启动语音识别
            this.startSpeechRecognition();
            
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
        
        // 标记等待识别完成
        this._pendingDuration = duration;
        
        // 停止语音识别 —— 移动端需要等 onend 回调确认识别彻底结束后再发送
        if (this.recognition) {
            // _recognitionEnded 标记由 onend 回调设置
            this._recognitionEnded = false;
            try { this.recognition.stop(); } catch(e) {}
            
            // 等待识别引擎 onend，最多等 2 秒，超时也发送
            this._sendTimer = setTimeout(() => {
                if (!this._recognitionEnded) {
                    console.warn('[VoiceHandler] 语音识别 onend 超时，强制发送');
                }
                this.sendRealVoice(this._pendingDuration);
            }, 2000);
        } else {
            // 没有识别引擎，直接延迟发送等待音频数据
            setTimeout(() => {
                this.sendRealVoice(duration);
            }, 500);
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
        
        this.recognition = new SpeechRecognition();
        // 移动端 continuous 模式不稳定，改为非连续模式
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'zh-CN';
        // 移动端设置较长的静音超时，避免过早结束
        if ('maxAlternatives' in this.recognition) {
            this.recognition.maxAlternatives = 1;
        }
        
        // 用于保存中间识别结果作为fallback
        this._interimTranscript = '';
        this._recognitionEnded = false;
        // 标记是否因为非连续模式自动结束需要重启
        this._shouldRestart = true;
        
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
            // no-speech / aborted 不需要重启
            if (event.error === 'no-speech' || event.error === 'aborted') {
                this._shouldRestart = false;
            }
        };
        
        this.recognition.onend = () => {
            console.log('[VoiceHandler] 语音识别 onend, isRecording:', this.isRecording, 'shouldRestart:', this._shouldRestart);
            this._recognitionEnded = true;
            
            if (this.isRecording && this._shouldRestart) {
                // 非连续模式下识别自动结束，但用户还在录音，需要重启识别
                try {
                    this.recognition.start();
                    console.log('[VoiceHandler] 语音识别已重启');
                } catch(e) {
                    console.warn('[VoiceHandler] 语音识别重启失败:', e);
                }
            } else if (!this.isRecording && this._sendTimer) {
                // 用户已松手，识别已结束，立即发送（取消超时等待）
                clearTimeout(this._sendTimer);
                this._sendTimer = null;
                // 短暂延迟确保 MediaRecorder.onstop 也完成
                setTimeout(() => {
                    this.sendRealVoice(this._pendingDuration);
                }, 300);
            }
        };
        
        try {
            this.recognition.start();
            console.log('[VoiceHandler] 语音识别已启动');
        } catch(e) {
            console.error('[VoiceHandler] 语音识别启动失败:', e);
        }
    },

    /**
     * 发送真实语音消息
     */
    sendRealVoice: function(duration) {
        if (!ChatInterface.currentCharId) return;
        
        // 在关闭面板之前保存识别文本和音频数据，因为closeVoicePanel会调用resetState清空recognizedText
        // 优先使用最终识别结果，如果没有则使用中间识别结果作为fallback
        const savedText = this.recognizedText || this._interimTranscript || '';
        const savedAudioBlob = this.currentAudioBlob;
        
        console.log('[VoiceHandler] 发送真实语音, 识别文本:', savedText, '最终结果:', this.recognizedText, '中间结果:', this._interimTranscript);
        
        // 先关闭面板
        this.closeVoicePanel();
        
        // 将音频转为 base64
        if (savedAudioBlob) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const audioBase64 = reader.result;
                this.createAndSendVoiceMessage(duration, audioBase64, savedText || '[语音消息]', false);
            };
            reader.readAsDataURL(savedAudioBlob);
        } else {
            this.createAndSendVoiceMessage(duration, null, savedText || '[语音消息]', false);
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
        
        this.createAndSendVoiceMessage(duration, null, text, true);
        this.closeVoicePanel();
    },

    /**
     * 创建并发送语音消息
     */
    createAndSendVoiceMessage: function(duration, audioData, text, isFake) {
        const msg = {
            id: Date.now(),
            sender: 'user',
            content: text,
            type: 'voice',
            timestamp: Date.now(),
            voiceData: {
                duration: duration,
                audioBase64: audioData,
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
            const audio = new Audio(voiceData.audioBase64);
            audio.play().catch(err => {
                console.error('音频播放失败:', err);
            });
        }
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceHandler;
}
