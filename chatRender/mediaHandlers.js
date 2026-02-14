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
        
        // 获取现有 camera-input
        let cameraInput = document.getElementById('camera-input');
        if (cameraInput) {
            // 【防止重复绑定】克隆替换，彻底移除所有旧事件监听器（含 addEventListener 和 inline）
            const newInput = cameraInput.cloneNode(false);
            newInput.removeAttribute('onchange');
            // 【优化 Input 属性】移动端 Chrome 标准属性：拍照使用 capture="camera"
            newInput.setAttribute('type', 'file');
            newInput.setAttribute('accept', 'image/*');
            newInput.setAttribute('capture', 'camera');
            newInput.id = 'camera-input';
            newInput.className = cameraInput.className;
            cameraInput.parentNode.replaceChild(newInput, cameraInput);
            cameraInput = newInput;
            // 标记已绑定，防止 _bindCameraInput 再次绑定
            cameraInput._boundByInit = true;

            // 绑定唯一的 change 事件（一次性）
            cameraInput.addEventListener('change', function _onCameraChange(e) {
                // 立即移除自身，确保只触发一次
                cameraInput.removeEventListener('change', _onCameraChange);
                if (e.target.files && e.target.files.length > 0) {
                    console.log('[MediaHandlers] Camera change triggered');
                    if (typeof ChatInterface !== 'undefined' && ChatInterface.handleCameraCapture) {
                        ChatInterface.handleCameraCapture(e.target);
                    } else {
                        MediaHandlers.handleCameraCapture(e.target, currentCharId);
                    }
                }
            });

            // 【直接触发】同步调用 click()，不套任何异步，移动端 Chrome 兼容
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
     * 处理相机拍摄的图片 - 移动端稳定版本（使用 FileReader）
     * @param {HTMLInputElement} input - 文件输入元素
     * @param {string} currentCharId - 当前角色ID
     * @param {Function} compressFunc - 图片压缩函数
     * @param {Function} renderCallback - 渲染回调函数
     */
    handleCameraCapture: function(input, currentCharId, compressFunc, renderCallback) {
        var file = input && input.files && input.files[0];
        if (!file) {
            return;
        }

        // 获取有效的角色ID
        var charId = this._getValidCharId(currentCharId);
        if (!charId) {
            input.value = '';
            return;
        }

        // 使用最稳定的 FileReader 读取文件
        var reader = new FileReader();
        reader.onload = function(e) {
            var base64Data = e.target.result;

            // 创建图片对象用于压缩
            var img = new Image();
            img.onload = function() {
                try {
                    var canvas = document.createElement('canvas');
                    var width = img.width;
                    var height = img.height;

                    // 移动端优化：最大600px
                    var MAX_SIZE = 600;
                    if (width > MAX_SIZE || height > MAX_SIZE) {
                        if (width > height) {
                            height = Math.round(height * MAX_SIZE / width);
                            width = MAX_SIZE;
                        } else {
                            width = Math.round(width * MAX_SIZE / height);
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // 质量0.5，大幅减少数据量
                    var compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);

                    // 发送消息
                    var msg = {
                        id: Date.now(),
                        sender: 'user',
                        content: compressedBase64,
                        type: 'image',
                        timestamp: Date.now(),
                        isVisionImage: true
                    };

                    API.Chat.addMessage(charId, msg);

                    // 渲染消息
                    if (renderCallback) {
                        renderCallback();
                    } else if (typeof ChatInterface !== 'undefined') {
                        ChatInterface.renderMessages();
                    }

                    // 更新角色列表
                    if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
                        ChatManager.renderList();
                    }

                    // 清理
                    MediaHandlers._clearPendingCharId();
                    input.value = '';
                } catch (err) {
                    console.error('[MediaHandlers] Camera compress error:', err);
                    input.value = '';
                }
            };
            img.onerror = function() {
                console.error('[MediaHandlers] Camera image load error');
                input.value = '';
            };
            img.src = base64Data;
        };
        reader.onerror = function() {
            console.error('[MediaHandlers] Camera FileReader error');
            input.value = '';
        };
        reader.readAsDataURL(file);
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

        // 获取现有 gallery-input
        let galleryInput = document.getElementById('gallery-input');
        if (galleryInput) {
            // 【防止重复绑定】克隆替换，彻底移除所有旧事件监听器（含 addEventListener 和 inline onchange）
            const newInput = galleryInput.cloneNode(false);
            newInput.removeAttribute('onchange');
            // 【优化 Input 属性】相册不需要 capture，只需 accept="image/*"
            newInput.setAttribute('type', 'file');
            newInput.setAttribute('accept', 'image/*');
            newInput.removeAttribute('capture');
            newInput.id = 'gallery-input';
            newInput.className = galleryInput.className;
            galleryInput.parentNode.replaceChild(newInput, galleryInput);
            galleryInput = newInput;

            // 绑定唯一的 change 事件（一次性）
            galleryInput.addEventListener('change', function _onGalleryChange(e) {
                // 立即移除自身，确保只触发一次
                galleryInput.removeEventListener('change', _onGalleryChange);
                if (e.target.files && e.target.files.length > 0) {
                    console.log('[MediaHandlers] Gallery change triggered');
                    if (typeof ChatInterface !== 'undefined' && ChatInterface.handleGallerySelect) {
                        ChatInterface.handleGallerySelect(e.target);
                    } else {
                        MediaHandlers.handleGallerySelect(e.target, currentCharId);
                    }
                }
            });

            // 【直接触发】同步调用 click()，不套任何异步，移动端 Chrome 兼容
            galleryInput.click();
        } else {
            console.error('[MediaHandlers] gallery-input not found!');
        }
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
