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
    /**
     * 打开相机
     */
    openCamera: function() {
        document.getElementById('panel-container').classList.add('hidden');
        document.getElementById('camera-input').click();
    },

    /**
     * 处理相机拍摄的图片
     * @param {HTMLInputElement} input - 文件输入元素
     * @param {string} currentCharId - 当前角色ID
     * @param {Function} compressFunc - 图片压缩函数
     * @param {Function} renderCallback - 渲染回调函数
     */
    handleCameraCapture: async function(input, currentCharId, compressFunc, renderCallback) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = e.target.result;
            
            // 压缩图片
            const compressedBase64 = await compressFunc(base64Data);
            
            // 发送图片消息到聊天（不自动触发AI回复）
            const msg = {
                id: Date.now(),
                sender: 'user',
                content: compressedBase64,
                type: 'image',
                timestamp: Date.now(),
                isVisionImage: true // 标记为需要Vision识图的图片
            };
            API.Chat.addMessage(currentCharId, msg);
            
            // 渲染消息
            if (renderCallback) renderCallback();
            
            // 实时更新角色列表
            if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
                ChatManager.renderList();
            }
        };
        reader.readAsDataURL(file);
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
     */
    openGalleryPicker: function() {
        this.closeGalleryMenu();
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

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = e.target.result;
            
            // 压缩图片
            const compressedBase64 = await compressFunc(base64Data);
            
            // 发送图片消息到聊天（不自动触发AI回复）
            const msg = {
                id: Date.now(),
                sender: 'user',
                content: compressedBase64,
                type: 'image',
                timestamp: Date.now(),
                isVisionImage: true // 标记为需要Vision识图的图片
            };
            API.Chat.addMessage(currentCharId, msg);
            
            // 渲染消息
            if (renderCallback) renderCallback();
            
            // 实时更新角色列表
            if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
                ChatManager.renderList();
            }
        };
        reader.readAsDataURL(file);
        input.value = ''; // 重置input
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MediaHandlers;
}
