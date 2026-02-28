/**
 * minimaxVoiceAPI.js
 * Minimax 语音合成 API 接口
 */

const MinimaxVoiceAPI = {
    // Vercel 部署域名
    VERCEL_HOST: 'https://rurichat.vercel.app',

    // 获取代理端点（自动判断环境）
    getProxyEndpoint: function() {
        var host = window.location.hostname;
        // 本地开发环境（localhost / 127.0.0.1 / 局域网IP）使用 Vercel 绝对路径
        if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.')) {
            return this.VERCEL_HOST + '/api/proxy';
        }
        // Vercel 生产环境使用相对路径
        return '/api/proxy';
    },

    // API 端点配置（保留兼容性）
    endpoints: {
        mainland: '/api/proxy',
        overseas: '/api/proxy',
        official: '/api/proxy'
    },

    /**
     * 获取配置
     */
    getConfig: function() {
        const config = JSON.parse(localStorage.getItem('minimaxVoiceConfig') || '{}');
        return {
            groupId: config.groupId || '',
            apiKey: config.apiKey || '',
            version: config.version || 'mainland',
            model: config.model || 'speech-01'
        };
    },

    /**
     * 语音合成
     * @param {string} text - 要合成的文本
     * @param {object} options - 选项参数
     * @returns {Promise<string>} - 返回音频URL
     */
    synthesize: async function(text, options = {}) {
        const config = this.getConfig();
        
        // 合并配置和选项
        const params = {
            groupId: options.groupId || config.groupId,
            apiKey: options.apiKey || config.apiKey,
            version: options.version || config.version,
            model: options.model || config.model,
            language: options.language || 'zh',
            speed: options.speed || 1.0,
            voiceId: options.voiceId || null // 角色专用语音ID
        };

        if (!params.groupId || !params.apiKey) {
            throw new Error('缺少必要的 Group ID 或 API Key');
        }

        if (!text || text.trim() === '') {
            throw new Error('文本内容不能为空');
        }

        if (!params.model || params.model.trim() === '') {
            throw new Error('模型名称不能为空');
        }

        const voiceId = params.voiceId || this.getDefaultVoiceId(params.language) || 'female-tianmei-jingpin';
        if (!voiceId) {
            throw new Error('语音ID不能为空');
        }

        const endpoint = this.getProxyEndpoint();
        
        // 直接向代理发送请求，不需要嵌套结构
        const requestBody = {
            model: params.model,
            text: text.trim(),
            voice_id: voiceId,
            speed: params.speed || 1.0,
            vol: 1.0,
            pitch: 0
        };

        console.log('=== Minimax API 代理请求详情 ===');
        console.log('代理端点:', endpoint);
        console.log('请求体:', JSON.stringify(requestBody, null, 2));

        try {
            console.log('[MinimaxAPI] 通过代理发送请求到:', endpoint);
            
            const fetchOptions = {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${params.apiKey}`,
                    'Content-Type': 'application/json',
                    'X-Group-Id': params.groupId
                },
                body: JSON.stringify(requestBody)
            };
            
            const response = await fetch(endpoint, fetchOptions);

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (errorData.error && errorData.error.message) {
                        errorMessage = errorData.error.message;
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (e) {
                    // 无法解析错误响应，使用默认错误信息
                }
                throw new Error(`API请求失败: ${errorMessage}`);
            }

            // 检查响应的Content-Type
            const contentType = response.headers.get('content-type');
            console.log('响应Content-Type:', contentType);
            
            if (contentType && contentType.includes('audio/')) {
                // 直接返回音频数据
                console.log('检测到音频响应，直接处理音频数据');
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                console.log('音频URL创建成功:', audioUrl);
                return audioUrl;
            }
            
            // 尝试解析JSON响应
            let data;
            try {
                data = await response.json();
                console.log('Minimax API 完整响应:', JSON.stringify(data, null, 2));
            } catch (e) {
                // 如果不是JSON，可能是直接的音频数据
                console.log('无法解析为JSON，尝试作为音频数据处理');
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                console.log('音频URL创建成功:', audioUrl);
                return audioUrl;
            }
            
            // 检查base_resp状态
            if (data.base_resp) {
                console.log('base_resp:', data.base_resp);
                if (data.base_resp.status_code !== 0 && data.base_resp.status_code !== 1000) {
                    throw new Error(`API错误: ${data.base_resp.status_msg || '未知错误'} (code: ${data.base_resp.status_code})`);
                }
            }
            
            // 尝试多种可能的响应格式
            let audioData = null;
            let audioFormat = 'audio/mpeg';
            
            // Minimax API 常见响应格式
            if (data.data && data.data.audio) {
                audioData = data.data.audio;
            } else if (data.extra_info && data.extra_info.audio) {
                audioData = data.extra_info.audio;
            } else if (data.audio_file) {
                audioData = data.audio_file;
            } else if (data.audio) {
                audioData = data.audio;
            } else if (data.result && data.result.audio) {
                audioData = data.result.audio;
            } else if (data.choices && data.choices[0] && data.choices[0].audio) {
                audioData = data.choices[0].audio;
            } else if (data.audio_url) {
                return data.audio_url;
            } else if (data.url) {
                return data.url;
            } else if (data.data && data.data.audio_url) {
                return data.data.audio_url;
            }
            
            if (audioData) {
                console.log('找到音频数据，类型:', typeof audioData, '长度:', audioData.length);
                // 检查是否是base64数据
                if (typeof audioData === 'string') {
                    // 如果是完整的data URL
                    if (audioData.startsWith('data:')) {
                        return audioData;
                    }
                    // 如果是纯base64，添加data URL前缀
                    const audioBlob = this.base64ToBlob(audioData, audioFormat);
                    return URL.createObjectURL(audioBlob);
                } else {
                    console.error('音频数据格式不正确:', typeof audioData);
                }
            }
            
            console.error('API完整响应:', data);
            console.error('可用的键:', Object.keys(data));
            if (data.data) {
                console.error('data字段的键:', Object.keys(data.data));
            }
            throw new Error('API响应中没有找到音频数据。响应结构: ' + JSON.stringify(Object.keys(data)));

        } catch (error) {
            console.error('Minimax语音合成失败:', error);
            throw error;
        }
    },

    /**
     * 获取默认语音ID
     * @param {string} language - 语言代码
     * @returns {string} - 语音ID
     */
    getDefaultVoiceId: function(language) {
        const voiceMap = {
            'zh': 'female-shaonv',       // 中文女声-少女
            'en': 'female-en-us-1',      // 英文女声
            'ja': 'female-ja-1',         // 日文女声
            'ko': 'female-ko-1'          // 韩文女声
        };
        return voiceMap[language] || 'female-shaonv';
    },

    /**
     * Base64转Blob
     * @param {string} base64 - base64字符串
     * @param {string} mimeType - MIME类型
     * @returns {Blob} - Blob对象
     */
    base64ToBlob: function(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    },

    /**
     * 获取角色语音配置
     * @param {string} characterId - 角色ID
     * @returns {object} - 语音配置
     */
    getCharacterVoiceConfig: function(characterId) {
        const characterVoices = JSON.parse(localStorage.getItem('characterVoices') || '{}');
        return characterVoices[characterId] || null;
    },

    /**
     * 保存角色语音配置
     * @param {string} characterId - 角色ID
     * @param {object} voiceConfig - 语音配置
     */
    saveCharacterVoiceConfig: function(characterId, voiceConfig) {
        const characterVoices = JSON.parse(localStorage.getItem('characterVoices') || '{}');
        characterVoices[characterId] = voiceConfig;
        localStorage.setItem('characterVoices', JSON.stringify(characterVoices));
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MinimaxVoiceAPI;
}