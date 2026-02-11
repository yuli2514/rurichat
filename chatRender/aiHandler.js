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
        if (input.value.trim()) chatInterface.sendUserMessage();

        const btn = document.querySelector('button[onclick="ChatInterface.triggerAI()"]');
        btn.classList.add('animate-pulse');
        
        const headerName = document.getElementById('chat-header-name');
        const originalName = headerName.textContent;
        const originalColor = headerName.style.color;
        headerName.textContent = '对方正在输入中...';
        headerName.style.color = '#9CA3AF';
        
        try {
            const bubbles = await API.Chat.generateReply(chatInterface.currentCharId);
            const history = API.Chat.getHistory(chatInterface.currentCharId);
            
            // 获取表情包映射（含义 -> URL）
            const char = API.Chat.getChar(chatInterface.currentCharId);
            const settings = char && char.settings ? char.settings : {};
            let emojiMeaningToUrl = {};
            if (settings.emojiGroupId) {
                const emojis = API.Emoji.getGroupEmojis(settings.emojiGroupId);
                emojis.forEach(e => {
                    emojiMeaningToUrl[e.meaning] = e.url;
                });
            }
            
            for (let text of bubbles) {
                // 检查撤回命令 [RECALL]
                const isRecall = text.includes('[RECALL]');
                if (isRecall) {
                    text = text.replace('[RECALL]', '').trim();
                }
                
                // 跳过空消息
                if (!text || text.trim() === '') continue;
                
                // 解析 [表情包：xxx] 格式
                const emojiMatch = text.match(/^\[表情包[：:]\s*(.+?)\s*\]$/);
                if (emojiMatch) {
                    const emojiMeaning = emojiMatch[1];
                    if (emojiMeaningToUrl[emojiMeaning]) {
                        text = emojiMeaningToUrl[emojiMeaning];
                    }
                }
                
                // 文字意念传图：检测图片描述格式 [图片:xxx] 或 [IMAGE:xxx]
                let isTextImageCard = false;
                const imageDescMatch = text.match(/^\[(?:图片|IMAGE|图像|画面)[：:]\s*(.+?)\s*\]$/i);
                if (imageDescMatch) {
                    const imageDescription = imageDescMatch[1];
                    // 使用 Canvas 生成白底文字卡片
                    text = chatInterface.generateTextImageCard(imageDescription);
                    isTextImageCard = true;
                }
                
                const isImageUrl = text.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)/i) ||
                                   text.startsWith('data:image/');
                
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
                const msg = {
                    id: msgId,
                    sender: 'ai',
                    content: text,
                    type: isImageUrl ? 'image' : 'text',
                    timestamp: Date.now(),
                    quote: quote
                };
                API.Chat.addMessage(chatInterface.currentCharId, msg);
                chatInterface.renderMessages();
                
                // 实时更新角色列表
                if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
                    ChatManager.renderList();
                }
                
                // 如果需要撤回，等待2秒后撤回
                if (isRecall) {
                    await new Promise(r => setTimeout(r, 2000));
                    const currentHistory = API.Chat.getHistory(chatInterface.currentCharId);
                    const msgIndex = currentHistory.findIndex(m => m.id === msgId);
                    if (msgIndex !== -1) {
                        currentHistory[msgIndex].recalled = true;
                        currentHistory[msgIndex].recalledAt = Date.now();
                        API.Chat.saveHistory(chatInterface.currentCharId, currentHistory);
                        chatInterface.renderMessages();
                        ChatManager.renderList();
                    }
                }
                
                // 消息之间等待1.2秒（模拟真实打字）
                await new Promise(r => setTimeout(r, 1200));
            }

            API.Chat.checkAutoSummary(chatInterface.currentCharId);

        } catch (e) {
            alert('AI 请求失败: ' + e.message);
        } finally {
            btn.classList.remove('animate-pulse');
            headerName.textContent = originalName;
            headerName.style.color = originalColor;
        }
    },

    /**
     * 重回功能 - 重新生成AI回复
     * @param {Object} chatInterface - ChatInterface引用
     */
    regenerateLastAI: async function(chatInterface) {
        const history = API.Chat.getHistory(chatInterface.currentCharId);
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
            API.Chat.saveHistory(chatInterface.currentCharId, history);
            chatInterface.renderMessages();
            ChatManager.renderList();
        }

        // 关闭扩展面板
        document.getElementById('panel-container').classList.add('hidden');

        // 自动触发AI重新生成
        await this.triggerAI(chatInterface);
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIHandler;
}
