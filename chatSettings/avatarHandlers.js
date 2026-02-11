/**
 * chatSettings/avatarHandlers.js
 * 聊天设置模块 - 头像和背景处理
 * 
 * 包含：
 * - 角色头像更新
 * - 用户头像更新
 * - 面板背景更新
 * - 聊天壁纸更新
 */

const AvatarHandlers = {
    /**
     * 更新角色头像
     * @param {HTMLInputElement} input - 文件输入元素
     */
    updateAvatar: function(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                const MAX_SIZE = 300;
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                
                const charId = ChatInterface.currentCharId;
                API.Chat.updateChar(charId, { avatar: dataUrl });
                
                document.getElementById('setting-char-avatar').src = dataUrl;
                ChatManager.renderList();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    /**
     * 更新用户头像（当前角色聊天专用）
     * @param {HTMLInputElement} input - 文件输入元素
     * @param {Function} updateSettingsCallback - 更新设置的回调函数
     */
    updateUserAvatar: function(input, updateSettingsCallback) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                const MAX_SIZE = 300;
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                
                try {
                    updateSettingsCallback({ userAvatar: dataUrl });
                    
                    const settingUserAvatar = document.getElementById('setting-user-avatar');
                    if (settingUserAvatar) {
                        settingUserAvatar.src = dataUrl;
                    }
                    
                    const chatUserAvatars = document.querySelectorAll('.user-message-avatar');
                    chatUserAvatars.forEach(avatar => {
                        avatar.src = dataUrl;
                    });
                    
                    if (ChatInterface.currentCharId) {
                        ChatInterface.renderMessages();
                    }
                    
                    alert('当前角色聊天用户头像已设置');
                } catch (err) {
                    console.error('Storage failed:', err);
                    alert('头像保存失败，可能是存储空间已满。请尝试更小的图片。');
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    /**
     * 更新设置面板背景
     * @param {HTMLInputElement} input - 文件输入元素
     * @param {Function} updateSettingsCallback - 更新设置的回调函数
     * @param {Function} loadSettingsCallback - 加载设置的回调函数
     */
    updatePanelBackground: function(input, updateSettingsCallback, loadSettingsCallback) {
        const file = input.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('图片过大，请选择小于5MB的图片');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                const MAX_SIZE = 800;
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);

                try {
                    updateSettingsCallback({ panelBackground: compressedDataUrl });
                    loadSettingsCallback();
                    alert('设置面板背景已更新！');
                } catch (err) {
                    console.error('Storage failed:', err);
                    alert('背景图保存失败，可能是存储空间已满。请尝试更简单的图片。');
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    /**
     * 更新聊天壁纸
     * @param {HTMLInputElement} input - 文件输入元素
     * @param {Function} updateSettingsCallback - 更新设置的回调函数
     */
    updateChatWallpaper: function(input, updateSettingsCallback) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            updateSettingsCallback({ wallpaper: e.target.result });
            document.getElementById('setting-chat-bg-preview').src = e.target.result;
            document.getElementById('setting-chat-bg-preview').classList.remove('hidden');
            document.getElementById('setting-chat-bg-placeholder').classList.add('hidden');
            
            document.getElementById('chat-messages').style.backgroundImage = 'url(' + e.target.result + ')';
            document.getElementById('chat-messages').style.backgroundSize = 'cover';
            document.getElementById('chat-messages').style.backgroundPosition = 'center';
        };
        reader.readAsDataURL(file);
    },

    /**
     * 清除聊天壁纸
     * @param {Function} updateSettingsCallback - 更新设置的回调函数
     */
    clearChatWallpaper: function(updateSettingsCallback) {
        updateSettingsCallback({ wallpaper: '' });
        document.getElementById('setting-chat-bg-preview').src = '';
        document.getElementById('setting-chat-bg-preview').classList.add('hidden');
        document.getElementById('setting-chat-bg-placeholder').classList.remove('hidden');
        document.getElementById('chat-messages').style.backgroundImage = '';
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AvatarHandlers;
}
