/**
 * chatRender/mediaHandlers.js
 * 聊天渲染模块 - 媒体处理器
 * 
 * 包含：
 * - 拍照功能
 * - 相册选择
 * - 文字描述画图
 * - 图片处理和发送
 */

const MediaHandlers = {
    // 保存当前角色ID，防止相机返回后丢失
    _pendingCharId: null,

    /**
     * 打开相机
     * @param {string} currentCharId - 当前角色ID（可选，用于保存）
     */
    openCamera: function(currentCharId) {
        console.log('[MediaHandlers] openCamera called, charId:', currentCharId);
        
        // 保存当前角色ID到临时变量和sessionStorage（防止页面刷新丢失）
        if (currentCharId) {
            this._pendingCharId = currentCharId;
            try {
                sessionStorage.setItem('_pendingCameraCharId', currentCharId);
            } catch (e) {
                console.warn('[MediaHandlers] Failed to save charId to sessionStorage:', e);
            }
        }
        
        const panelContainer = document.getElementById('panel-container');
        if (panelContainer) {
            panelContainer.classList.add('hidden');
        }
        
        const cameraInput = document.getElementById('camera-input');
        console.log('[MediaHandlers] camera-input element:', cameraInput);
        if (cameraInput) {
            cameraInput.click();
        } else {
            console.error('[MediaHandlers] camera-input not found!');
        }
    },

    /**
     * 获取待处理的角色ID（优先从参数获取，其次从缓存获取）
     * @param {string} currentCharId - 传入的角色ID
     * @returns {string} 有效的角色ID
     */
    _getValidCharId: function(currentCharId) {
        // 优先使用传入的ID
        if (currentCharId) return currentCharId;
        
        // 其次使用内存缓存
        if (this._pendingCharId) return this._pendingCharId;
        
        // 最后尝试从sessionStorage恢复
        try {
            const savedId = sessionStorage.getItem('_pendingCameraCharId');
            if (savedId) return savedId;
        } catch (e) {
            console.warn('[MediaHandlers] Failed to read charId from sessionStorage:', e);
        }
        
        // 兜底：从ChatInterface获取
        if (typeof ChatInterface !== 'undefined' && ChatInterface.currentCharId) {
            return ChatInterface.currentCharId;
        }
        
        return null;
    },

    /**
     * 清理待处理的角色ID缓存
     */
    _clearPendingCharId: function() {
        this._pendingCharId = null;
        try {
            sessionStorage.removeItem('_pendingCameraCharId');
        } catch (e) {}
    },

    /**
     * 处理相机拍摄的图片
     * @param {HTMLInputElement} input - 文件输入元素
     * @param {string} currentCharId - 当前角色ID
     * @param {Function} compressFunc - 图片压缩函数
     * @param {Function} renderCallback - 渲染回调函数
     */
    handleCameraCapture: async function(input, currentCharId, compressFunc, renderCallback) {
        console.log('[MediaHandlers] handleCameraCapture called');
        console.log('[MediaHandlers] input.files:', input.files);
        
        const file = input.files[0];
        if (!file) {
            console.log('[MediaHandlers] No file selected');
            return;
        }
        
        console.log('[MediaHandlers] File selected:', file.name, file.size, file.type);

        // 获取有效的角色ID
        const charId = this._getValidCharId(currentCharId);
        console.log('[MediaHandlers] handleCameraCapture - charId:', charId);
        
        if (!charId) {
            console.error('[MediaHandlers] No valid charId found for camera capture');
            alert('无法发送图片：未找到当前聊天角色');
            input.value = '';
            return;
        }

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                console.log('[MediaHandlers] FileReader onload triggered');
                const base64Data = e.target.result;
                
                // 压缩图片
                let compressedBase64;
                try {
                    if (compressFunc) {
                        compressedBase64 = await compressFunc(base64Data);
                    } else if (typeof ChatRenderUtils !== 'undefined') {
                        // 兜底：直接使用工具函数
                        compressedBase64 = await ChatRenderUtils.compressImageForChat(base64Data);
                    } else {
                        compressedBase64 = base64Data;
                    }
                } catch (compressError) {
                    console.error('[MediaHandlers] Image compression failed:', compressError);
                    compressedBase64 = base64Data; // 压缩失败则使用原图
                }
                
                // 发送图片消息到聊天（不自动触发AI回复）
                const msg = {
                    id: Date.now(),
                    sender: 'user',
                    content: compressedBase64,
                    type: 'image',
                    timestamp: Date.now(),
                    isVisionImage: true // 标记为需要Vision识图的图片
                };
                API.Chat.addMessage(charId, msg);
                console.log('[MediaHandlers] Image message added to chat:', charId);
                
                // 渲染消息
                if (renderCallback) {
                    renderCallback();
                } else if (typeof ChatInterface !== 'undefined') {
                    // 兜底：直接调用ChatInterface渲染
                    ChatInterface.renderMessages();
                }
                
                // 实时更新角色列表
                if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
                    ChatManager.renderList();
                }
                
                // 清理缓存
                MediaHandlers._clearPendingCharId();
            };
            
            reader.onerror = (e) => {
                console.error('[MediaHandlers] FileReader error:', e);
            };
            
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('[MediaHandlers] handleCameraCapture error:', error);
        }
        
        input.value = ''; // 重置input
    },

    /**
     * 打开相册子菜单
     */
    openGalleryMenu: function() {
        const submenu = document.getElementById('gallery-submenu');
        submenu.classList.remove('hidden');
    },

    /**
     * 关闭相册子菜单
     */
    closeGalleryMenu: function() {
        const submenu = document.getElementById('gallery-submenu');
        submenu.classList.add('hidden');
    },

    /**
     * 打开文字描述画图弹窗
     */
    openTextDrawing: function() {
        this.closeGalleryMenu();
        document.getElementById('panel-container').classList.add('hidden');
        // 直接显示弹窗
        const modal = document.getElementById('text-drawing-modal');
        modal.classList.remove('hidden');
        document.getElementById('text-drawing-input').value = '';
        // 延迟focus避免键盘弹出卡顿
        setTimeout(() => {
            document.getElementById('text-drawing-input').focus();
        }, 100);
    },

    /**
     * 关闭文字描述画图弹窗
     */
    closeTextDrawing: function() {
        document.getElementById('text-drawing-modal').classList.add('hidden');
    },

    /**
     * 发送文字描述画图
     * @param {string} currentCharId - 当前角色ID
     * @param {Function} generateImageFunc - 生成图片函数
     * @param {Function} renderCallback - 渲染回调函数
     */
    sendTextDrawing: function(currentCharId, generateImageFunc, renderCallback) {
        const input = document.getElementById('text-drawing-input');
        const description = input.value.trim();
        if (!description) {
            alert('请输入图片描述');
            return;
        }

        // 生成文字占位图
        const imageDataUrl = generateImageFunc(description);

        // 发送图片消息
        const msg = {
            id: Date.now(),
            sender: 'user',
            content: imageDataUrl,
            type: 'image',
            timestamp: Date.now(),
            textDrawingDesc: description // 保存描述，供AI回复时使用
        };
        API.Chat.addMessage(currentCharId, msg);
        
        // 渲染消息
        if (renderCallback) renderCallback();
        
        // 实时更新角色列表
        if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
            ChatManager.renderList();
        }

        // 清空输入框但不关闭弹窗
        input.value = '';
        input.focus();
    },

    /**
     * 打开相册选择器
     * @param {string} currentCharId - 当前角色ID（可选，用于保存）
     */
    openGalleryPicker: function(currentCharId) {
        this.closeGalleryMenu();
        // 保存当前角色ID（与相机共用缓存机制）
        if (currentCharId) {
            this._pendingCharId = currentCharId;
            try {
                sessionStorage.setItem('_pendingCameraCharId', currentCharId);
            } catch (e) {
                console.warn('[MediaHandlers] Failed to save charId to sessionStorage:', e);
            }
        }
        document.getElementById('panel-container').classList.add('hidden');
        document.getElementById('gallery-input').click();
    },

    /**
     * 处理相册选择的图片
     * @param {HTMLInputElement} input - 文件输入元素
     * @param {string} currentCharId - 当前角色ID
     * @param {Function} compressFunc - 图片压缩函数
     * @param {Function} renderCallback - 渲染回调函数
     */
    handleGallerySelect: async function(input, currentCharId, compressFunc, renderCallback) {
        const file = input.files[0];
        if (!file) return;

        // 获取有效的角色ID
        const charId = this._getValidCharId(currentCharId);
        console.log('[MediaHandlers] handleGallerySelect - charId:', charId);
        
        if (!charId) {
            console.error('[MediaHandlers] No valid charId found for gallery select');
            alert('无法发送图片：未找到当前聊天角色');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = e.target.result;
            
            // 压缩图片
            let compressedBase64;
            if (compressFunc) {
                compressedBase64 = await compressFunc(base64Data);
            } else if (typeof ChatRenderUtils !== 'undefined') {
                compressedBase64 = await ChatRenderUtils.compressImageForChat(base64Data);
            } else {
                compressedBase64 = base64Data;
            }
            
            // 发送图片消息到聊天（不自动触发AI回复）
            const msg = {
                id: Date.now(),
                sender: 'user',
                content: compressedBase64,
                type: 'image',
                timestamp: Date.now(),
                isVisionImage: true // 标记为需要Vision识图的图片
            };
            API.Chat.addMessage(charId, msg);
            console.log('[MediaHandlers] Gallery image added to chat:', charId);
            
            // 渲染消息
            if (renderCallback) {
                renderCallback();
            } else if (typeof ChatInterface !== 'undefined') {
                ChatInterface.renderMessages();
            }
            
            // 实时更新角色列表
            if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
                ChatManager.renderList();
            }
            
            // 清理缓存
            MediaHandlers._clearPendingCharId();
        };
        reader.readAsDataURL(file);
        input.value = ''; // 重置input
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MediaHandlers;
}
