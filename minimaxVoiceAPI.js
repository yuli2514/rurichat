/**
 * minimaxVoiceAPI.js
 * Minimax 语音合成 API 接口
 */

const MinimaxVoiceAPI = {
    // API 端点配置
    endpoints: {
        mainland: 'https://api.minimax.chat/v1/text_to_speech',
        overseas: 'https://api.minimax.chat/v1/text_to_speech', 
        official: 'https://api.minimax.chat/v1/text_to_speech'
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

        const endpoint = `${this.endpoints[params.version]}?GroupId=${params.groupId}`;
        
        const requestBody = {
            model: params.model,
            text: text.trim(),
            voice_id: voiceId,
            speed: params.speed || 1.0,
            vol: 1.0,
            pitch: 0
        };

        console.log('=== Minimax API 请求详情 ===');
        console.log('端点:', endpoint);
        console.log('请求体:', JSON.stringify(requestBody, null, 2));
        console.log('各字段检查:');
        console.log('  - model:', requestBody.model, '(类型:', typeof requestBody.model, ')');
        console.log('  - text:', requestBody.text, '(类型:', typeof requestBody.text, ', 长度:', requestBody.text?.length, ')');
        console.log('  - voice_id:', requestBody.voice_id, '(类型:', typeof requestBody.voice_id, ')');
        console.log('  - speed:', requestBody.speed, '(类型:', typeof requestBody.speed, ')');
        console.log('  - vol:', requestBody.vol, '(类型:', typeof requestBody.vol, ')');
        console.log('  - pitch:', requestBody.pitch, '(类型:', typeof requestBody.pitch, ')');

        try {
            const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            console.log('[MinimaxAPI] 发送请求到:', endpoint);
            
            // 移动端使用简化的请求头，避免触发 CORS 预检
            const fetchOptions = {
                method: 'POST',
                body: JSON.stringify(requestBody)
            };
            
            // 只在非移动端或确认支持的情况下添加自定义头
            if (!isMobile) {
                fetchOptions.headers = {
                    'Authorization': `Bearer ${params.apiKey}`,
                    'Content-Type': 'application/json'
                };
            } else {
                // 移动端尝试不同的方式
                console.log('[MinimaxAPI] 移动端模式，尝试简化请求');
                
                // 方式1: 通过 URL 参数传递认证信息
                const mobileEndpoint = `${endpoint}&apiKey=${encodeURIComponent(params.apiKey)}`;
                fetchOptions.headers = {
                    'Content-Type': 'application/json'
                };
                
                try {
                    const response = await fetch(mobileEndpoint, fetchOptions);
                    if (response.ok) {
                        console.log('[MinimaxAPI] 移动端URL参数方式成功');
                        return await this.handleResponse(response);
                    }
                } catch (urlError) {
                    console.log('[MinimaxAPI] URL参数方式失败，尝试标准方式');
                }
                
                // 方式2: 标准方式
                fetchOptions.headers = {
                    'Authorization': `Bearer ${params.apiKey}`,
                    'Content-Type': 'application/json'
                };
            }
            
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
            console.error('错误详情:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                userAgent: navigator.userAgent,
                isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            });
            
            const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // 移动端尝试备用请求方式
            if (isMobile && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
                console.log('[MinimaxAPI] 移动端fetch失败，尝试XMLHttpRequest备用方案');
                try {
                    return await this.synthesizeWithXHR(text, params, requestBody, endpoint);
                } catch (xhrError) {
                    console.error('[MinimaxAPI] XMLHttpRequest备用方案也失败:', xhrError);
                    throw new Error('移动端网络请求失败，请检查网络连接或尝试切换网络');
                }
            }
            
            // 为移动端提供更友好的错误信息
            if (isMobile) {
                if (error.message.includes('fetch')) {
                    throw new Error('移动端网络请求失败，请检查网络连接');
                } else if (error.message.includes('CORS')) {
                    throw new Error('移动端跨域请求被阻止');
                } else if (error.message.includes('blob')) {
                    throw new Error('移动端音频处理失败');
                }
            }
            
            throw error;
        }
    },

    /**
     * 使用XMLHttpRequest的备用请求方式（移动端兼容）
     */
    synthesizeWithXHR: function(text, params, requestBody, endpoint) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', endpoint, true);
            xhr.setRequestHeader('Authorization', `Bearer ${params.apiKey}`);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.responseType = 'blob';
            
            xhr.onload = function() {
                if (xhr.status === 200) {
                    console.log('[MinimaxAPI] XMLHttpRequest请求成功');
                    const audioBlob = xhr.response;
                    const audioUrl = URL.createObjectURL(audioBlob);
                    resolve(audioUrl);
                } else {
                    console.error('[MinimaxAPI] XMLHttpRequest请求失败:', xhr.status, xhr.statusText);
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                }
            };
            
            xhr.onerror = function() {
                console.error('[MinimaxAPI] XMLHttpRequest网络错误');
                reject(new Error('网络连接失败'));
            };
            
            xhr.ontimeout = function() {
                console.error('[MinimaxAPI] XMLHttpRequest请求超时');
                reject(new Error('请求超时'));
            };
            
            xhr.timeout = 30000; // 30秒超时
            
            try {
                xhr.send(JSON.stringify(requestBody));
            } catch (e) {
                reject(new Error('发送请求失败: ' + e.message));
            }
        });
    },

    /**
     * 处理API响应
     */
    handleResponse: async function(response) {
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

// 导出到全局
window.MinimaxVoiceAPI = MinimaxVoiceAPI;