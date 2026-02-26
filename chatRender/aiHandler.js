/**
 * chatRender/aiHandler.js
 * 聊天渲染模块 - AI交互处理器
 * 
 * 包含：
 * - 触发AI回复
 * - 解析AI回复格式
 * - 重回功能（重新生成AI回复）
 */

const AIHandler = {
    /**
     * 触发AI回复
     * @param {Object} chatInterface - ChatInterface引用
     */
    triggerAI: async function(chatInterface) {
        const input = document.getElementById('chat-input');
        if (input.value.trim()) ChatInterface.sendUserMessage();

        const btn = document.querySelector('button[onclick="ChatInterface.triggerAI()"]');
        btn.classList.add('animate-pulse');
        
        const headerName = document.getElementById('chat-header-name');
        const originalName = headerName.textContent;
        const originalColor = headerName.style.color;
        headerName.textContent = '对方正在输入中...';
        headerName.style.color = '#9CA3AF';
        headerName.classList.add('typing-indicator');
        
        try {
            const bubbles = await API.Chat.generateReply(ChatInterface.currentCharId);
            const history = API.Chat.getHistory(ChatInterface.currentCharId);
            
            // 生成本次AI回复的唯一标识（用于轮数计算去重）
            const replyId = 'reply_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            // 获取表情包映射（含义 -> URL）支持多选表情包分组
            const char = API.Chat.getChar(ChatInterface.currentCharId);
            const settings = char && char.settings ? char.settings : {};
            let emojiMeaningToUrl = {};
            const emojiGroupIds = settings.emojiGroupIds || (settings.emojiGroupId ? [settings.emojiGroupId] : []);
            if (emojiGroupIds.length > 0) {
                emojiGroupIds.forEach(groupId => {
                    const emojis = API.Emoji.getGroupEmojis(groupId);
                    emojis.forEach(e => {
                        emojiMeaningToUrl[e.meaning] = e.url;
                    });
                });
            }
            
            for (let text of bubbles) {
                // 🚫 最优先拦截：检测编码数据，直接跳过
                if (text && text.length > 15 && /^[A-Za-z0-9+/=\s\n\r]+$/.test(text) && !/[\u4e00-\u9fa5]/.test(text)) {
                    console.error('[AIHandler] 🚫 在最早阶段拦截编码数据，跳过消息:', text.substring(0, 30) + '...');
                    continue;
                }
                
                // --- 前端物理过滤：抹除AI回复中残留的系统描述和旁白 ---
                // 但保留有效的功能性指令（如文件、语音、转账等）
                
                // 清除表情包系统描述复读（如 [用户发送了一个表情包...] ）
                text = text.replace(/\[用户发送了一个表情包[^\]]*\]/g, '').trim();
                // 清除图片信息复述（如 [用户发送了一张图片...] ）
                text = text.replace(/\[用户发送了一张图片[^\]]*\]/g, '').trim();
                text = text.replace(/\[发送了一张图片[^\]]*\]/g, '').trim();
                // 清除发件人标记复读（如 [发件人: User] [发件人: You]）
                text = text.replace(/\[发件人:\s*(?:User|You)\]\s*/g, '').trim();
                // 清除整行旁白（整条消息就是 *旁白内容*，前后无其他文字）
                if (/^\*[^*]+\*$/.test(text.trim())) { text = ''; }
                // 清除系统说明复读（如 [表情: xxx] 被AI原样输出时），但保留功能性指令
                if (!/^\[(?:文件|FILE|语音|VOICE|转账|TRANSFER|图片|IMAGE|换头像|CHANGE_AVATAR|领取转账|RECEIVE_TRANSFER)[：:]/i.test(text)) {
                    text = text.replace(/\[表情:\s*[^\]]+\]/g, '').trim();
                }
                // 清除线上模式锁死指令复读
                text = text.replace(/\[手机网聊模式[^\]]*\]/g, '').trim();

                // 检查撤回命令 [RECALL]
                const isRecall = text.includes('[RECALL]');
                if (isRecall) {
                    text = text.replace('[RECALL]', '').trim();
                }
                
                // 跳过空消息（包括被过滤后变空的消息）
                if (!text || text.trim() === '') continue;
                
                // 🔍 调试：记录每条AI消息
                console.log('[AIHandler] 处理AI消息:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
                
                // 🖼️ 检测AI发送的base64图片数据，标记为图片类型而非文本
                let isBase64Image = false;
                if (text.startsWith('data:image/')) {
                    console.log('[AIHandler] 🖼️ 检测到AI发送的base64图片');
                    isBase64Image = true;
                    // 不拦截，后面会标记为 type: 'image' 进行渲染
                }
                
                // 🚫 拦截其他非图片的编码数据
                const textLen = text.length;
                const hasChinese = /[\u4e00-\u9fa5]/.test(text);
                const hasNormalPunctuation = /[，。！？、；：""''（）【】]/.test(text);
                const isBase64Like = /^[A-Za-z0-9+/=\s\n\r]+$/.test(text);
                const isHexLike = /^[A-Fa-f0-9]+$/.test(text);
                
                // 只拦截非图片的编码数据
                const isNonImageEncodedData = !isBase64Image && (
                    text.startsWith('data:') ||        // 非图片的data: URL
                    // 长度>50且是纯base64字符，没有中文和正常标点
                    (textLen > 50 && !hasChinese && !hasNormalPunctuation && isBase64Like) ||
                    // 检测十六进制编码（长度>100的纯十六进制）
                    (textLen > 100 && isHexLike) ||
                    // 检测转义编码
                    (textLen > 50 && text.includes('\\x')) ||
                    // 检测数字数组编码
                    (textLen > 50 && /^[0-9,\s]+$/.test(text) && text.includes(','))
                );
                
                if (isNonImageEncodedData) {
                    console.warn('[AIHandler] 🚫 检测到非图片编码数据，正在拦截！');
                    console.log('[AIHandler] 文本长度:', textLen);
                    console.log('[AIHandler] 前100字符:', text.substring(0, 100));
                    
                    // 跳过这条消息，不显示
                    console.log('[AIHandler] ✅ 已跳过编码数据消息');
                    continue;
                }
                
                // 清理AI可能添加的markdown图片格式：![xxx](url) -> url
                const markdownImgMatch = text.match(/^!\[.*?\]\((.+?)\)$/);
                if (markdownImgMatch) {
                    text = markdownImgMatch[1];
                }
                // 清理markdown链接格式：[xxx](url) -> url（仅当内容看起来像表情包链接时）
                const markdownLinkMatch = text.match(/^\[.*?\]\((https?:\/\/.+?)\)$/);
                if (markdownLinkMatch) {
                    text = markdownLinkMatch[1];
                }
                
                // 解析 [表情包：xxx] 格式
                const emojiMatch = text.match(/^\[表情包[：:]\s*(.+?)\s*\]$/);
                if (emojiMatch) {
                    const emojiMeaning = emojiMatch[1];
                    if (emojiMeaningToUrl[emojiMeaning]) {
                        text = emojiMeaningToUrl[emojiMeaning];
                    }
                }
                
                // AI换头像：检测 [换头像] 或 [CHANGE_AVATAR] 格式
                let isChangeAvatar = false;
                const changeAvatarMatch = text.match(/^\[(?:换头像|更换头像|CHANGE_AVATAR)\]$/i);
                if (changeAvatarMatch) {
                    isChangeAvatar = true;
                    // 查找最近一条用户发送的图片（真实图片，非表情包）
                    const history = API.Chat.getHistory(ChatInterface.currentCharId);
                    for (let i = history.length - 1; i >= 0; i--) {
                        const msg = history[i];
                        // 只处理用户发送的真实图片（isVisionImage标记），不处理表情包
                        if (msg.sender === 'user' && msg.type === 'image' && msg.isVisionImage &&
                            msg.content && msg.content.startsWith('data:image/')) {
                            // 更新角色头像
                            API.Chat.updateChar(ChatInterface.currentCharId, { avatar: msg.content });
                            // 更新界面显示
                            const headerAvatar = document.getElementById('chat-header-avatar');
                            if (headerAvatar) headerAvatar.src = msg.content;
                            // 刷新聊天列表
                            if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
                                ChatManager.renderList();
                            }
                            console.log('[AIHandler] 角色头像已更换');
                            break;
                        }
                    }
                    continue; // 跳过这条消息，不显示
                }
                
                // AI领取转账：检测 [领取转账] 或 [收下转账] 格式
                let isReceiveTransfer = false;
                const receiveTransferMatch = text.match(/^\[(?:领取转账|收下转账|接受转账|RECEIVE_TRANSFER)\]$/i);
                if (receiveTransferMatch) {
                    isReceiveTransfer = true;
                    // 查找最近一条用户发送的待领取转账
                    const history = API.Chat.getHistory(ChatInterface.currentCharId);
                    for (let i = history.length - 1; i >= 0; i--) {
                        const msg = history[i];
                        if (msg.type === 'transfer' && msg.transferData &&
                            msg.transferData.fromUser && msg.transferData.status === 'pending') {
                            TransferHandler.receiveTransfer(i);
                            break;
                        }
                    }
                    continue; // 跳过这条消息，不显示
                }
                
                // AI转账消息：检测 [转账:金额] 或 [转账:金额:备注] 格式（优先检测）
                let isTransferMessage = false;
                let transferAmount = 0;
                let transferRemark = '';
                // 更宽松的正则：支持各种格式如 [转账:100]、[转账：100元]、[转账:100:备注]
                const transferMatch = text.match(/^\[(?:转账|TRANSFER)[：:]\s*(\d+(?:\.\d{0,2})?)\s*元?\s*(?:[：:]\s*(.+?))?\s*\]$/i);
                if (transferMatch) {
                    transferAmount = parseFloat(transferMatch[1]);
                    transferRemark = transferMatch[2] || '';
                    isTransferMessage = true;
                    console.log('[AIHandler] 检测到转账消息:', transferAmount, transferRemark);
                }
                
                // 文字意念传图：检测图片描述格式 [图片:xxx] 或 [IMAGE:xxx]
                let isTextImageCard = false;
                if (!isTransferMessage) {
                    const imageDescMatch = text.match(/^\[(?:图片|IMAGE|图像|画面)[：:]\s*(.+?)\s*\]$/i);
                    if (imageDescMatch) {
                        const imageDescription = imageDescMatch[1];
                        
                        // 🚫 检查是否是表情包URL或表情包含义，如果是则跳过意念图生成
                        const isEmojiUrl = /^https?:\/\//.test(imageDescription);
                        const isEmojiMeaning = Object.values(emojiMeaningToUrl).includes(imageDescription) ||
                                             Object.keys(emojiMeaningToUrl).some(meaning => meaning.includes(imageDescription));
                        
                        if (isEmojiUrl || isEmojiMeaning) {
                            console.log('[AIHandler] 🚫 检测到表情包内容被误写成意念图格式，已修正');
                            // 如果是URL，直接使用URL；如果是含义，转换为对应URL
                            if (isEmojiUrl) {
                                text = imageDescription;
                            } else {
                                // 查找对应的表情包URL
                                const matchedUrl = Object.keys(emojiMeaningToUrl).find(meaning =>
                                    meaning.includes(imageDescription) || imageDescription.includes(meaning)
                                );
                                text = matchedUrl ? emojiMeaningToUrl[matchedUrl] : imageDescription;
                            }
                        } else {
                            // 检查最近是否频繁发送意念图，如果是则跳过
                            const history = API.Chat.getHistory(ChatInterface.currentCharId);
                            const recentMessages = history.slice(-5); // 检查最近5条消息
                            const recentImageCount = recentMessages.filter(msg =>
                                msg.sender === 'ai' && msg.type === 'image' &&
                                msg.content && msg.content.startsWith('data:image/')
                            ).length;
                            
                            if (recentImageCount >= 2) {
                                console.log('[AIHandler] 🚫 最近已发送过多意念图，跳过此次发送');
                                // 跳过意念图，将其转换为普通文字
                                text = '（' + imageDescription + '）';
                            } else {
                                // 使用 Canvas 生成白底文字卡片
                                text = ChatInterface.generateTextImageCard(imageDescription);
                                isTextImageCard = true;
                            }
                        }
                    }
                }
                
                // AI语音消息：检测 [语音:xxx] 或 [VOICE:xxx] 格式
                // 支持更宽松的匹配，允许前后有空格
                let isVoiceMessage = false;
                let voiceContent = null;
                if (!isTransferMessage) {
                    // 先尝试严格匹配整行
                    let voiceMatch = text.match(/^\[(?:语音|VOICE|voice)[：:]\s*(.+?)\s*\]$/i);
                    // 如果没匹配到，尝试宽松匹配（可能有前后空格或其他字符）
                    if (!voiceMatch) {
                        voiceMatch = text.match(/\[(?:语音|VOICE|voice)[：:]\s*(.+?)\s*\]/i);
                    }
                    if (voiceMatch) {
                        voiceContent = voiceMatch[1];
                        isVoiceMessage = true;
                        console.log('[AIHandler] 检测到语音消息:', voiceContent);
                    }
                }
                
                // AI文件消息：检测 [文件:文件名:内容] 或 [FILE:filename:content] 格式
                let isFileMessage = false;
                let fileName = '';
                let fileContent = '';
                let fileDescription = '';
                if (!isTransferMessage && !isVoiceMessage) {
                    // 匹配格式：[文件:filename:content] 或 [文件:filename:content:description]
                    const fileMatch = text.match(/^\[(?:文件|FILE)[：:]\s*([^：:]+?)\s*[：:]\s*([\s\S]*?)\s*(?:[：:]\s*(.+?))?\s*\]$/i);
                    if (fileMatch) {
                        fileName = fileMatch[1].trim();
                        fileContent = fileMatch[2].trim();
                        fileDescription = fileMatch[3] ? fileMatch[3].trim() : `AI为您生成了文件: ${fileName}`;
                        isFileMessage = true;
                        console.log('[AIHandler] 检测到文件消息:', fileName, '内容长度:', fileContent.length);
                    }
                }
                
                // 检查是否是图片URL：
                // 1. 以常见图片扩展名结尾（可能带参数）
                // 2. 是已知的表情包URL（在emojiMeaningToUrl的值中）
                // 3. URL中包含图片扩展名（不一定在结尾）
                const isKnownEmojiUrl = Object.values(emojiMeaningToUrl).includes(text);
                const hasImageExtension = /\.(jpg|jpeg|png|gif|webp)/i.test(text);
                const isImageUrl = text.match(/^https?:\/\//) && (
                    hasImageExtension ||
                    isKnownEmojiUrl
                );
                
                // 解析引用格式 [QUOTE:content]
                let quote = null;
                const quoteMatch = text.match(/^\[QUOTE:(.+?)\]/);
                if (quoteMatch) {
                    const quoteContent = quoteMatch[1];
                    text = text.replace(quoteMatch[0], '').trim();
                    
                    // 移除引用后如果文本为空则跳过
                    if (!text || text.trim() === '') continue;
                    
                    // 在历史记录中查找被引用的消息
                    const quotedMsg = history.find(m =>
                        !m.recalled &&
                        m.content &&
                        m.content.includes(quoteContent)
                    );
                    if (quotedMsg) {
                        quote = {
                            id: quotedMsg.id,
                            sender: quotedMsg.sender,
                            content: quotedMsg.content,
                            type: quotedMsg.type
                        };
                    }
                }
                
                const msgId = Date.now() + Math.random();
                
                // 根据消息类型构建不同的消息对象
                let msg;
                if (isTransferMessage) {
                    // AI转账消息
                    const char = API.Chat.getChar(ChatInterface.currentCharId);
                    msg = {
                        id: msgId,
                        sender: 'char',
                        content: '',
                        type: 'transfer',
                        timestamp: Date.now(),
                        transferData: {
                            amount: transferAmount,
                            remark: transferRemark,
                            status: 'pending',
                            fromUser: false,
                            fromName: char ? char.remark : '对方',
                            createdAt: Date.now()
                        }
                    };
                } else if (isVoiceMessage) {
                    // AI语音消息
                    const voiceDuration = Math.max(1, Math.ceil(voiceContent.length / 3.5));
                    msg = {
                        id: msgId,
                        sender: 'ai',
                        content: voiceContent,
                        type: 'voice',
                        timestamp: Date.now(),
                        quote: quote,
                        voiceData: {
                            duration: voiceDuration,
                            audioBase64: null,
                            isFake: true,
                            transcription: voiceContent
                        }
                    };
                } else if (isFileMessage) {
                    // AI文件消息
                    msg = {
                        id: msgId,
                        sender: 'ai',
                        content: fileContent,
                        type: 'ai_file',
                        timestamp: Date.now(),
                        quote: quote,
                        fileName: fileName,
                        description: fileDescription
                    };
                    console.log('[AIHandler] 📄 创建AI文件消息:', fileName);
                } else {
                    // 判断消息类型：
                    // 1. isImageUrl - HTTP图片URL
                    // 2. isBase64Image - data:image/ 开头的base64图片
                    // 3. isTextImageCard - 文字意念传图生成的图片
                    const msgType = (isImageUrl || isBase64Image || isTextImageCard) ? 'image' : 'text';
                    
                    msg = {
                        id: msgId,
                        sender: 'ai',
                        content: text,
                        type: msgType,
                        timestamp: Date.now(),
                        quote: quote
                    };
                    
                    if (isBase64Image) {
                        console.log('[AIHandler] 🖼️ 将base64图片标记为image类型');
                    }
                }
                const updatedHistory = API.Chat.addMessage(ChatInterface.currentCharId, msg);
                // 使用增量追加代替全量重渲染，避免卡顿
                ChatInterface.appendSingleMessage(msg, updatedHistory.length - 1);
                
                // 实时更新角色列表
                if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
                    ChatManager.renderList();
                }
                
                // 如果需要撤回，等待2秒后撤回
                if (isRecall) {
                    await new Promise(r => setTimeout(r, 2000));
                    const currentHistory = API.Chat.getHistory(ChatInterface.currentCharId);
                    const msgIndex = currentHistory.findIndex(m => m.id === msgId);
                    if (msgIndex !== -1) {
                        // 保存撤回的消息内容，让AI知道自己撤回了什么
                        currentHistory[msgIndex].recalled = true;
                        currentHistory[msgIndex].recalledAt = Date.now();
                        currentHistory[msgIndex].recalledContent = text; // 保存撤回的内容
                        API.Chat.saveHistory(ChatInterface.currentCharId, currentHistory);
                        ChatInterface.renderMessages();
                        ChatManager.renderList();
                    }
                }
                
                // 消息之间等待1.2秒（模拟真实打字）
                await new Promise(r => setTimeout(r, 1200));
            }

            API.Chat.checkAutoSummary(ChatInterface.currentCharId);

        } catch (e) {
            console.error('[AIHandler] AI请求失败:', e);
            
            // 构建详细错误提示
            const now = new Date();
            const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0') + ':' + now.getSeconds().toString().padStart(2, '0');
            
            let errorType = '未知错误';
            let errorDetail = e.message || '无详细信息';
            const status = e.httpStatus || 0;
            
            if (status === 401 || status === 403) {
                errorType = 'API密钥无效或已过期';
            } else if (status === 402 || errorDetail.includes('insufficient_quota') || errorDetail.includes('quota') || errorDetail.includes('balance')) {
                errorType = 'API额度不足';
            } else if (status === 429) {
                errorType = '请求频率超限';
            } else if (status === 404) {
                errorType = 'API地址或模型不存在';
            } else if (status === 500 || status === 502 || status === 503) {
                errorType = 'API服务器错误';
            } else if (errorDetail.includes('Failed to fetch') || errorDetail.includes('NetworkError') || errorDetail.includes('network')) {
                errorType = '网络连接失败';
            } else if (errorDetail.includes('AI返回内容为空')) {
                errorType = 'AI返回空回复';
            } else if (errorDetail.includes('请先在设置中配置')) {
                errorType = 'API未配置';
            }
            
            const errorContent = `⚠️ [${timeStr}] 请求失败\n类型：${errorType}\n详情：${errorDetail}`;
            
            // 在聊天界面中显示错误消息气泡
            const errorMsg = {
                sender: 'ai',
                content: errorContent,
                type: 'text',
                timestamp: Date.now(),
                isError: true
            };
            const updatedHistory = API.Chat.addMessage(ChatInterface.currentCharId, errorMsg);
            ChatInterface.appendSingleMessage(errorMsg, updatedHistory.length - 1);
            
            if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
                ChatManager.renderList();
            }
        } finally {
            btn.classList.remove('animate-pulse');
            headerName.textContent = originalName;
            headerName.style.color = originalColor;
            headerName.classList.remove('typing-indicator');
        }
    },

    /**
     * 重回功能 - 重新生成AI回复
     * @param {Object} chatInterface - ChatInterface引用
     */
    regenerateLastAI: async function() {
        const history = API.Chat.getHistory(ChatInterface.currentCharId);
        if (history.length === 0) return;

        // 检查最后一条消息是否是AI的
        const lastMsg = history[history.length - 1];
        if (lastMsg.sender === 'user') {
            alert('最后一条消息是你发送的，无法重回');
            return;
        }

        // 删除最后一轮AI的所有回复（连续的AI消息）
        let removeCount = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].sender === 'ai' || history[i].sender === 'assistant') {
                removeCount++;
            } else {
                break;
            }
        }

        if (removeCount > 0) {
            history.splice(history.length - removeCount, removeCount);
            API.Chat.saveHistory(ChatInterface.currentCharId, history);
            
            // 优化：只移除对应数量的消息气泡，避免全量重建
            this._removeLastMessageBubbles(removeCount);
            ChatManager.renderList();
        }

        // 关闭扩展面板
        document.getElementById('panel-container').classList.add('hidden');

        // 自动触发AI重新生成
        await this.triggerAI(ChatInterface);
    },

    /**
     * 移除最后几个消息气泡（避免全量重建）
     * @param {Object} chatInterface - ChatInterface引用
     * @param {number} count - 要移除的消息数量
     */
    _removeLastMessageBubbles: function(count) {
        const container = document.getElementById('chat-messages');
        if (!container) {
            // 如果找不到容器，回退到全量重建
            ChatInterface.renderMessages();
            return;
        }
        
        // 移除最后count个消息气泡
        for (let i = 0; i < count; i++) {
            const lastBubble = container.lastElementChild;
            if (lastBubble) {
                lastBubble.remove();
            } else {
                // 如果DOM结构不符合预期，回退到全量重建
                ChatInterface.renderMessages();
                break;
            }
        }
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIHandler;
}
