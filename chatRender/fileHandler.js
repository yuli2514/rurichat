/**
 * chatRender/fileHandler.js
 * 聊天渲染模块 - 文件处理器
 * 
 * 包含：
 * - 文件选择和上传
 * - 文件内容读取和解析
 * - 文件发送给AI
 * - AI发送文件给用户
 * - 支持多种文件格式
 */

const FileHandler = {
    // 支持的文件类型配置
    supportedTypes: {
        text: ['.txt', '.md', '.json', '.js', '.ts', '.html', '.css', '.xml', '.csv', '.log', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.sh', '.bat', '.yaml', '.yml', '.ini', '.conf', '.cfg', '.sql'],
        document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],
        archive: ['.zip', '.rar', '.7z', '.tar', '.gz']
    },

    // 最大文件大小 (10MB)
    maxFileSize: 10 * 1024 * 1024,

    /**
     * 打开文件选择器
     */
    openFilePicker: function() {
        console.log('[FileHandler] 打开文件选择器');
        
        // 隐藏扩展面板
        const panelContainer = document.getElementById('panel-container');
        if (panelContainer) {
            panelContainer.classList.add('hidden');
        }
        
        // 触发文件选择
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.click();
        } else {
            console.error('[FileHandler] file-input 元素未找到');
            alert('文件选择器初始化失败');
        }
    },

    /**
     * 处理文件选择
     * @param {HTMLInputElement} input - 文件输入元素
     */
    handleFileSelect: async function(input) {
        console.log('[FileHandler] 处理文件选择');
        
        if (!input.files || input.files.length === 0) {
            console.log('[FileHandler] 没有选择文件');
            return;
        }

        const file = input.files[0];
        console.log('[FileHandler] 选择的文件:', file.name, file.size, file.type);

        try {
            // 验证文件
            if (!this.validateFile(file)) {
                return;
            }

            // 获取当前角色ID
            const charId = this.getCurrentCharId();
            if (!charId) {
                alert('请先选择一个角色进行聊天');
                return;
            }

            // 读取文件内容
            const fileContent = await this.readFileContent(file);
            
            // 发送文件消息
            await this.sendFileMessage(charId, file, fileContent);
            
            // 清空输入
            input.value = '';
            
        } catch (error) {
            console.error('[FileHandler] 文件处理失败:', error);
            alert('文件处理失败: ' + error.message);
            input.value = '';
        }
    },

    /**
     * 验证文件
     * @param {File} file - 文件对象
     * @returns {boolean} 是否有效
     */
    validateFile: function(file) {
        // 检查文件大小
        if (file.size > this.maxFileSize) {
            alert(`文件太大，最大支持 ${Math.round(this.maxFileSize / 1024 / 1024)}MB`);
            return false;
        }

        // 检查文件类型
        const fileName = file.name.toLowerCase();
        const isSupported = Object.values(this.supportedTypes).some(types => 
            types.some(ext => fileName.endsWith(ext))
        );

        if (!isSupported) {
            alert('不支持的文件类型。支持的格式：文本文件、文档、压缩包等');
            return false;
        }

        return true;
    },

    /**
     * 读取文件内容
     * @param {File} file - 文件对象
     * @returns {Promise<string>} 文件内容
     */
    readFileContent: function(file) {
        return new Promise((resolve, reject) => {
            const fileName = file.name.toLowerCase();
            
            // 对于文本类型文件，读取内容
            if (this.supportedTypes.text.some(ext => fileName.endsWith(ext))) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        let content = e.target.result;
                        
                        // 限制内容长度，避免过长
                        if (content.length > 50000) {
                            content = content.substring(0, 50000) + '\n\n[文件内容过长，已截断...]';
                        }
                        
                        resolve(content);
                    } catch (error) {
                        reject(new Error('文件内容读取失败: ' + error.message));
                    }
                };
                reader.onerror = () => reject(new Error('文件读取失败'));
                reader.readAsText(file, 'UTF-8');
            } else {
                // 对于其他类型文件，返回基本信息
                resolve(`[文件: ${file.name}]\n类型: ${file.type || '未知'}\n大小: ${this.formatFileSize(file.size)}\n\n此文件类型暂不支持内容预览，但AI可以了解文件的基本信息。`);
            }
        });
    },

    /**
     * 发送文件消息
     * @param {string} charId - 角色ID
     * @param {File} file - 文件对象
     * @param {string} content - 文件内容
     */
    sendFileMessage: async function(charId, file, content) {
        console.log('[FileHandler] 发送文件消息');
        
        // 创建文件消息
        const msg = {
            id: Date.now(),
            sender: 'user',
            content: content,
            type: 'file',
            timestamp: Date.now(),
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || 'unknown'
        };

        // 添加到聊天历史
        API.Chat.addMessage(charId, msg);

        // 渲染消息
        if (typeof ChatInterface !== 'undefined') {
            const history = API.Chat.getHistory(charId);
            ChatInterface.appendSingleMessage(msg, history.length - 1);
        }

        // 更新聊天列表
        if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
            ChatManager.renderList();
        }

        console.log('[FileHandler] 文件消息发送完成');
    },

    /**
     * AI发送文件给用户
     * @param {string} charId - 角色ID
     * @param {string} fileName - 文件名
     * @param {string} content - 文件内容
     * @param {string} description - 文件描述
     */
    sendAIFile: function(charId, fileName, content, description = '') {
        console.log('[FileHandler] AI发送文件给用户');
        
        // 创建AI文件消息
        const msg = {
            id: Date.now(),
            sender: 'ai',
            content: content,
            type: 'ai_file',
            timestamp: Date.now(),
            fileName: fileName,
            description: description || `AI为您生成了文件: ${fileName}`
        };

        // 添加到聊天历史
        API.Chat.addMessage(charId, msg);

        // 渲染消息
        if (typeof ChatInterface !== 'undefined') {
            const history = API.Chat.getHistory(charId);
            ChatInterface.appendSingleMessage(msg, history.length - 1);
        }

        // 更新聊天列表
        if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
            ChatManager.renderList();
        }

        console.log('[FileHandler] AI文件消息发送完成');
    },

    /**
     * 查看文件内容
     * @param {number} messageIndex - 消息索引
     */
    viewFileContent: function(messageIndex) {
        try {
            const charId = this.getCurrentCharId();
            if (!charId) {
                alert('无法获取当前角色信息');
                return;
            }

            const history = API.Chat.getHistory(charId);
            const msg = history[messageIndex];
            
            if (!msg || (msg.type !== 'file' && msg.type !== 'ai_file')) {
                alert('文件消息不存在');
                return;
            }

            const fileName = msg.fileName || '未知文件';
            const content = msg.content || '文件内容为空';
            
            // 创建文件查看模态框
            this.showFileViewModal(fileName, content);
            
        } catch (error) {
            console.error('[FileHandler] 查看文件内容失败:', error);
            alert('查看文件内容失败: ' + error.message);
        }
    },

    /**
     * 显示文件查看模态框
     * @param {string} fileName - 文件名
     * @param {string} content - 文件内容
     */
    showFileViewModal: function(fileName, content) {
        // 移除已存在的模态框
        const existingModal = document.getElementById('file-view-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 创建模态框HTML
        const modalHtml = `
            <div id="file-view-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
                <div class="bg-white rounded-2xl w-[90%] h-[80%] max-w-[500px] shadow-2xl flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b border-gray-200">
                        <h3 class="font-bold text-lg text-gray-800 truncate flex-1 mr-2">${fileName}</h3>
                        <button onclick="FileHandler.closeFileViewModal()" class="text-gray-400 hover:text-gray-600 text-xl">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div class="flex-1 overflow-y-auto p-4">
                        <pre class="text-sm text-gray-700 whitespace-pre-wrap break-words font-mono leading-relaxed">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                    </div>
                    <div class="p-4 border-t border-gray-200 flex gap-2">
                        <button onclick="FileHandler.copyFileContent()" class="flex-1 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium active:scale-95 transition">
                            <i class="fa-solid fa-copy mr-1"></i>复制内容
                        </button>
                        <button onclick="FileHandler.closeFileViewModal()" class="flex-1 py-2 bg-blue-500 text-white rounded-xl font-medium active:scale-95 transition">
                            关闭
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // 存储当前文件内容供复制使用
        this._currentFileContent = content;
    },

    /**
     * 关闭文件查看模态框
     */
    closeFileViewModal: function() {
        const modal = document.getElementById('file-view-modal');
        if (modal) {
            modal.remove();
        }
        this._currentFileContent = null;
    },

    /**
     * 复制文件内容
     */
    copyFileContent: function() {
        if (!this._currentFileContent) {
            alert('没有可复制的内容');
            return;
        }

        try {
            navigator.clipboard.writeText(this._currentFileContent).then(() => {
                alert('内容已复制到剪贴板');
            }).catch(() => {
                // 降级方案
                const textArea = document.createElement('textarea');
                textArea.value = this._currentFileContent;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('内容已复制到剪贴板');
            });
        } catch (error) {
            console.error('[FileHandler] 复制失败:', error);
            alert('复制失败');
        }
    },

    /**
     * 下载AI发送的文件
     * @param {string} fileName - 文件名
     * @param {string} content - 文件内容
     */
    downloadAIFile: function(fileName, content) {
        try {
            // 创建下载链接
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // 清理URL对象
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            console.log('[FileHandler] 文件下载完成:', fileName);
        } catch (error) {
            console.error('[FileHandler] 文件下载失败:', error);
            alert('文件下载失败: ' + error.message);
        }
    },

    /**
     * 获取当前角色ID
     * @returns {string|null} 角色ID
     */
    getCurrentCharId: function() {
        if (typeof ChatInterface !== 'undefined' && ChatInterface.currentCharId) {
            return ChatInterface.currentCharId;
        }
        return null;
    },

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的大小
     */
    formatFileSize: function(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * 获取文件图标
     * @param {string} fileName - 文件名
     * @returns {string} Font Awesome 图标类名
     */
    getFileIcon: function(fileName) {
        const name = fileName.toLowerCase();
        
        // 文本文件
        if (name.endsWith('.txt') || name.endsWith('.md')) return 'fa-file-text';
        if (name.endsWith('.json') || name.endsWith('.xml')) return 'fa-file-code';
        if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.html') || name.endsWith('.css')) return 'fa-file-code';
        if (name.endsWith('.py') || name.endsWith('.java') || name.endsWith('.c') || name.endsWith('.cpp')) return 'fa-file-code';
        
        // 文档文件
        if (name.endsWith('.pdf')) return 'fa-file-pdf';
        if (name.endsWith('.doc') || name.endsWith('.docx')) return 'fa-file-word';
        if (name.endsWith('.xls') || name.endsWith('.xlsx')) return 'fa-file-excel';
        if (name.endsWith('.ppt') || name.endsWith('.pptx')) return 'fa-file-powerpoint';
        
        // 压缩文件
        if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z') || name.endsWith('.tar') || name.endsWith('.gz')) return 'fa-file-archive';
        
        // 默认
        return 'fa-file';
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileHandler;
}