/**
 * ui.js
 * 负责核心工具函数、滑动逻辑、文件上传辅助以及聊天列表管理
 */

// ==================== UTILITIES ====================
function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const statusBarTime = document.getElementById('status-bar-time');
    const liveTime = document.getElementById('live-time');
    const liveDate = document.getElementById('live-date');
    
    if (statusBarTime) statusBarTime.textContent = hours + ':' + minutes;
    if (liveTime) liveTime.textContent = hours + ':' + minutes;
    if (liveDate) liveDate.textContent = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

const SwipeLogic = {
    currentPage: 0,
    startX: 0,
    startY: 0,
    isDragging: false,
    
    init: function() {
        const container = document.getElementById('swipe-container');
        const track = document.getElementById('slider-track');
        const dot1 = document.getElementById('dot-1');
        const dot2 = document.getElementById('dot-2');

        if (!container || !track || !dot1 || !dot2) return;

        // Touch events for mobile
        container.addEventListener('touchstart', (e) => {
            this.startX = e.touches[0].clientX;
            this.startY = e.touches[0].clientY;
            this.isDragging = true;
            track.style.transition = 'none';
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = currentX - this.startX;
            const diffY = currentY - this.startY;
            
            // Only handle horizontal swipes
            if (Math.abs(diffX) > Math.abs(diffY)) {
                const baseOffset = this.currentPage * -50;
                const dragOffset = (diffX / container.clientWidth) * 50;
                const newOffset = Math.max(-50, Math.min(0, baseOffset + dragOffset));
                track.style.transform = `translateX(${newOffset}%)`;
            }
        }, { passive: true });

        container.addEventListener('touchend', (e) => {
            if (!this.isDragging) return;
            this.isDragging = false;
            track.style.transition = 'transform 0.3s ease-out';
            
            const endX = e.changedTouches[0].clientX;
            const diffX = endX - this.startX;
            const threshold = container.clientWidth * 0.2;
            
            if (diffX < -threshold && this.currentPage === 0) {
                this.currentPage = 1;
            } else if (diffX > threshold && this.currentPage === 1) {
                this.currentPage = 0;
            }
            
            this.updatePosition();
        }, { passive: true });

        // Mouse events for desktop
        container.addEventListener('mousedown', (e) => {
            this.startX = e.clientX;
            this.isDragging = true;
            track.style.transition = 'none';
            container.style.cursor = 'grabbing';
        });

        container.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const diffX = e.clientX - this.startX;
            const baseOffset = this.currentPage * -50;
            const dragOffset = (diffX / container.clientWidth) * 50;
            const newOffset = Math.max(-50, Math.min(0, baseOffset + dragOffset));
            track.style.transform = `translateX(${newOffset}%)`;
        });

        container.addEventListener('mouseup', (e) => {
            if (!this.isDragging) return;
            this.isDragging = false;
            track.style.transition = 'transform 0.3s ease-out';
            container.style.cursor = 'grab';
            
            const diffX = e.clientX - this.startX;
            const threshold = container.clientWidth * 0.2;
            
            if (diffX < -threshold && this.currentPage === 0) {
                this.currentPage = 1;
            } else if (diffX > threshold && this.currentPage === 1) {
                this.currentPage = 0;
            }
            
            this.updatePosition();
        });

        container.addEventListener('mouseleave', () => {
            if (this.isDragging) {
                this.isDragging = false;
                track.style.transition = 'transform 0.3s ease-out';
                container.style.cursor = 'grab';
                this.updatePosition();
            }
        });
    },
    
    updatePosition: function() {
        const track = document.getElementById('slider-track');
        const dot1 = document.getElementById('dot-1');
        const dot2 = document.getElementById('dot-2');
        
        track.style.transform = `translateX(${this.currentPage * -50}%)`;
        
        if (this.currentPage === 0) {
            dot1.classList.remove('bg-gray-300');
            dot1.classList.add('bg-gray-800');
            dot2.classList.remove('bg-gray-800');
            dot2.classList.add('bg-gray-300');
        } else {
            dot1.classList.remove('bg-gray-800');
            dot1.classList.add('bg-gray-300');
            dot2.classList.remove('bg-gray-300');
            dot2.classList.add('bg-gray-800');
        }
    }
};

function setupUploader(inputId, imgId, textId, placeholderId, callback) {
    const input = document.getElementById(inputId);
    const img = document.getElementById(imgId);
    const textSpan = textId ? document.getElementById(textId) : null;
    const placeholder = placeholderId ? document.getElementById(placeholderId) : null;
    
    if (!input) return;
    input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Compress image before setting
            const reader = new FileReader();
            reader.onload = function(evt) {
                const tempImg = new Image();
                tempImg.onload = function() {
                    const canvas = document.createElement('canvas');
                    let width = tempImg.width;
                    let height = tempImg.height;
                    
                    // Max dimension for home screen images
                    const MAX_SIZE = 500;
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
                    ctx.drawImage(tempImg, 0, 0, width, height);
                    
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    
                    if (img) {
                        img.src = compressedDataUrl;
                        img.classList.remove('hidden');
                    }
                    if (textSpan) textSpan.classList.add('hidden');
                    if (placeholder) placeholder.classList.add('hidden');
                    if (callback) callback(compressedDataUrl);
                };
                tempImg.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

// ==================== HOME MANAGER ====================
const HomeManager = {
    init: function() {
        this.loadData();
        this.bindEvents();
        this.setupUploaders();
    },

    loadData: function() {
        const data = API.Home.getData();
        
        // Text Fields
        if (data.userName) document.getElementById('home-user-name').textContent = data.userName;
        if (data.userId) document.getElementById('home-user-id').textContent = data.userId;
        if (data.userLocation) document.getElementById('home-user-location').innerHTML = `<i class="fa-solid fa-location-dot text-[12px]"></i> ${data.userLocation}`;
        if (data.userBio) document.getElementById('home-user-bio').textContent = data.userBio;
        if (data.moodTitle) document.getElementById('home-mood-title').textContent = data.moodTitle;
        if (data.moodContent) document.getElementById('home-mood-content').textContent = data.moodContent;

        // Images
        if (data.avatarTop) {
            const img = document.getElementById('avatar-top-preview');
            img.src = data.avatarTop;
            img.classList.remove('hidden');
            document.getElementById('avatar-top-text').classList.add('hidden');
        }
        if (data.avatarCard) {
            const img = document.getElementById('avatar-card-preview');
            img.src = data.avatarCard;
            img.classList.remove('hidden');
            document.getElementById('avatar-card-text').classList.add('hidden');
        }
        if (data.imageRect) {
            const img = document.getElementById('image-preview-rect');
            img.src = data.imageRect;
            img.classList.remove('hidden');
            document.getElementById('upload-placeholder').classList.add('hidden');
        }
    },

    bindEvents: function() {
        const fields = [
            { id: 'home-user-name', key: 'userName' },
            { id: 'home-user-id', key: 'userId' },
            { id: 'home-user-location', key: 'userLocation', isHtml: true },
            { id: 'home-user-bio', key: 'userBio' },
            { id: 'home-mood-title', key: 'moodTitle' },
            { id: 'home-mood-content', key: 'moodContent' }
        ];

        fields.forEach(field => {
            const el = document.getElementById(field.id);
            if (el) {
                el.addEventListener('blur', () => {
                    const val = field.isHtml ? el.textContent.trim() : el.textContent.trim(); // For location we just want text content for now to avoid icon duplication issues if we re-render, but let's stick to textContent for simplicity
                    API.Home.saveData({ [field.key]: val });
                });
            }
        });
    },

    setupUploaders: function() {
        setupUploader('upload-avatar-top', 'avatar-top-preview', 'avatar-top-text', null, (url) => {
            API.Home.saveData({ avatarTop: url });
        });
        setupUploader('upload-avatar-card', 'avatar-card-preview', 'avatar-card-text', null, (url) => {
            API.Home.saveData({ avatarCard: url });
        });
        setupUploader('upload-rect', 'image-preview-rect', null, 'upload-placeholder', (url) => {
            API.Home.saveData({ imageRect: url });
        });
    }
};

// ==================== CHAT MANAGER UI ====================
const ChatManager = {
    currentAvatarBase64: null,
    longPressTimer: null,
    longPressCharId: null,
    isLongPress: false,

    init: function() {
        this.bindEvents();
        this.renderList();
        this.initContextMenu();
    },

    bindEvents: function() {
        document.getElementById('chat-app-icon').addEventListener('click', () => {
            document.getElementById('chat-app').classList.remove('hidden');
        });
        document.getElementById('close-chat-btn').addEventListener('click', () => {
            document.getElementById('chat-app').classList.add('hidden');
        });
    },

    // 初始化长按菜单
    initContextMenu: function() {
        const menu = document.getElementById('char-context-menu');
        const pinBtn = document.getElementById('char-menu-pin');
        const deleteBtn = document.getElementById('char-menu-delete');

        // 点击其他地方关闭菜单
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target)) {
                this.hideContextMenu();
            }
        });

        // 置顶/取消置顶按钮
        pinBtn.addEventListener('click', () => {
            if (this.longPressCharId) {
                this.togglePin(this.longPressCharId);
            }
            this.hideContextMenu();
        });

        // 删除按钮
        deleteBtn.addEventListener('click', () => {
            if (this.longPressCharId) {
                this.deleteCharacter(this.longPressCharId);
            }
            this.hideContextMenu();
        });
    },

    // 显示长按菜单
    showContextMenu: function(charId, x, y) {
        const menu = document.getElementById('char-context-menu');
        const pinBtn = document.getElementById('char-menu-pin');
        const char = API.Chat.getChar(charId);
        
        this.longPressCharId = charId;
        
        // 根据置顶状态更新按钮文字
        if (char && char.pinned) {
            pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack text-orange-400"></i><span>取消置顶</span>';
        } else {
            pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack text-gray-400"></i><span>置顶</span>';
        }
        
        // 定位菜单
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.remove('hidden');
        
        // 确保菜单不超出屏幕
        const menuRect = menu.getBoundingClientRect();
        const chatApp = document.getElementById('chat-app');
        const chatRect = chatApp.getBoundingClientRect();
        
        if (menuRect.right > chatRect.right) {
            menu.style.left = (x - menuRect.width) + 'px';
        }
        if (menuRect.bottom > chatRect.bottom) {
            menu.style.top = (y - menuRect.height) + 'px';
        }
    },

    // 隐藏长按菜单
    hideContextMenu: function() {
        const menu = document.getElementById('char-context-menu');
        menu.classList.add('hidden');
        this.longPressCharId = null;
    },

    // 切换置顶状态
    togglePin: function(charId) {
        let chars = API.Chat.getChars();
        const idx = chars.findIndex(c => c.id === charId);
        if (idx !== -1) {
            chars[idx].pinned = !chars[idx].pinned;
            API.Chat.saveChars(chars);
            this.renderList();
        }
    },

    // 删除角色
    deleteCharacter: function(charId) {
        const char = API.Chat.getChar(charId);
        if (!char) return;
        
        if (confirm('确定要删除角色 "' + (char.remark || char.name) + '" 吗？\n删除后聊天记录也会被清除。')) {
            API.Chat.deleteChar(charId);
            this.renderList();
        }
    },

    openAddModal: function() {
        const modal = document.getElementById('add-char-modal');
        const content = document.getElementById('add-char-modal-content');
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        });
        
        document.getElementById('new-char-name').value = '';
        document.getElementById('new-char-remark').value = '';
        document.getElementById('new-char-user-name').value = '';
        document.getElementById('new-char-prompt').value = '';
        document.getElementById('new-char-url').value = '';
        document.getElementById('new-char-file').value = '';
        document.getElementById('new-char-avatar-preview').src = 'https://ui-avatars.com/api/?name=New';
        this.currentAvatarBase64 = null;
    },

    closeAddModal: function() {
        const modal = document.getElementById('add-char-modal');
        const content = document.getElementById('add-char-modal-content');
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 200);
    },

    handleAvatarFile: function(input) {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.currentAvatarBase64 = e.target.result;
                document.getElementById('new-char-avatar-preview').src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    },
    
    handleAvatarUrl: function(input) {
        const inputUrl = input.value.trim();
        if (inputUrl) {
            document.getElementById('new-char-avatar-preview').src = inputUrl;
            this.currentAvatarBase64 = null;
        }
    },

    saveCharacter: function() {
        const name = document.getElementById('new-char-name').value.trim();
        const remark = document.getElementById('new-char-remark').value.trim();
        const userName = document.getElementById('new-char-user-name').value.trim();
        const prompt = document.getElementById('new-char-prompt').value.trim();
        const urlAvatar = document.getElementById('new-char-url').value.trim();
        
        if (!name) return alert('请输入角色姓名');

        let avatar = this.currentAvatarBase64 || urlAvatar || 'https://ui-avatars.com/api/?name=' + name + '&background=random';
        
        const newChar = {
            id: 'char_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: name,
            remark: remark || name,
            prompt: prompt,
            avatar: avatar,
            lastMessage: '新角色已创建',
            timestamp: Date.now(),
            settings: {
                worldBookId: '',
                emojiGroupId: '',
                contextLength: 20,
                autoSummary: false,
                summaryFreq: 10,
                summaryPrompt: '',
                userName: userName || '用户'  // 用户在此角色聊天中的称呼
            }
        };

        try {
            API.Chat.addChar(newChar);
            this.renderList();
            this.closeAddModal();
        } catch (e) {
            console.error('添加角色失败:', e);
            alert('保存失败: ' + (e.message || '存储数据可能已损坏') + '\n\n请尝试：\n1. 清理浏览器存储空间\n2. 刷新页面后重试');
        }
    },

    _needsRefresh: false, // 标记列表是否需要刷新

    renderList: function() {
        // 如果聊天界面正在显示，延迟到返回列表时再渲染
        const superInterface = document.getElementById('super-chat-interface');
        if (superInterface && !superInterface.classList.contains('hidden')) {
            this._needsRefresh = true;
            return;
        }

        const listContainer = document.getElementById('chat-list-container');
        let chars = API.Chat.getChars();

        if (!Array.isArray(chars) || chars.length === 0) {
            listContainer.innerHTML = '<div class="flex flex-col items-center justify-center h-48 text-gray-400 mt-10"><i class="fa-regular fa-comment-dots text-4xl mb-2 opacity-50"></i><p class="text-xs">暂无聊天</p></div>';
            return;
        }

        try {
            listContainer.innerHTML = '';
            
            // 排序：置顶的角色排在前面，其他按原顺序
            const pinnedChars = chars.filter(c => c.pinned);
            const unpinnedChars = chars.filter(c => !c.pinned);
            const sortedChars = [...pinnedChars, ...unpinnedChars];
            
            const self = this;
            
            sortedChars.forEach(char => {
                const item = document.createElement('div');
                // 置顶的角色添加浅灰色背景
                const pinnedClass = char.pinned ? 'bg-gray-100' : '';
                item.className = 'chat-list-item cursor-pointer hover:bg-gray-100 active:bg-gray-200 transition-colors relative ' + pinnedClass;
                
                // Get last message from chat history
                let lastMessageText = char.lastMessage || '暂无消息';
                let lastMessageTimestamp = null;
                const history = API.Chat.getHistory(char.id);
                if (history && history.length > 0) {
                    // Find the last non-recalled message
                    let lastMsg = null;
                    for (let i = history.length - 1; i >= 0; i--) {
                        if (!history[i].recalled) {
                            lastMsg = history[i];
                            break;
                        }
                    }
                    
                    if (lastMsg) {
                        if (lastMsg.type === 'image') {
                            lastMessageText = '[图片]';
                        } else {
                            lastMessageText = lastMsg.content || '暂无消息';
                        }
                        // 使用最后一条消息的时间戳
                        lastMessageTimestamp = lastMsg.timestamp;
                    } else {
                        // All messages are recalled
                        lastMessageText = '消息已撤回';
                    }
                }
                
                // Format timestamp - 使用最后一条消息的时间，而不是角色创建时间
                let timeText = '';
                const timestampToUse = lastMessageTimestamp || char.timestamp;
                if (timestampToUse) {
                    const now = Date.now();
                    const diff = now - timestampToUse;
                    const minutes = Math.floor(diff / 60000);
                    const hours = Math.floor(diff / 3600000);
                    const days = Math.floor(diff / 86400000);
                    
                    if (minutes < 1) {
                        timeText = '刚刚';
                    } else if (minutes < 60) {
                        timeText = minutes + '分钟前';
                    } else if (hours < 24) {
                        timeText = hours + '小时前';
                    } else if (days < 7) {
                        timeText = days + '天前';
                    } else {
                        const date = new Date(timestampToUse);
                        timeText = (date.getMonth() + 1) + '/' + date.getDate();
                    }
                }
                
                // 置顶图标
                const pinIcon = char.pinned ? '<i class="fa-solid fa-thumbtack text-orange-400 text-[10px] ml-1"></i>' : '';
                
                item.innerHTML =
                    '<img src="' + char.avatar + '" class="w-[50px] h-[50px] rounded-full object-cover shrink-0 bg-gray-200">' +
                    '<div class="ml-3 flex-1 min-w-0 h-[50px] flex flex-col justify-center chat-list-item-content">' +
                        '<div class="flex justify-between items-center mb-0.5">' +
                            '<div class="flex items-center min-w-0 flex-1">' +
                                '<h4 class="font-medium text-gray-900 text-[15px] truncate">' + char.remark + '</h4>' +
                                pinIcon +
                            '</div>' +
                            '<span class="text-[10px] text-gray-400 shrink-0 ml-2">' + timeText + '</span>' +
                        '</div>' +
                        '<p class="text-[13px] text-gray-400 truncate leading-tight">' + lastMessageText + '</p>' +
                    '</div>';
                
                // 长按事件处理
                let longPressTimer = null;
                let isLongPress = false;
                let startX = 0;
                let startY = 0;
                
                // 触摸开始
                item.addEventListener('touchstart', function(e) {
                    isLongPress = false;
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                    longPressTimer = setTimeout(function() {
                        isLongPress = true;
                        // 获取触摸位置相对于chat-app的坐标
                        const chatApp = document.getElementById('chat-app');
                        const chatRect = chatApp.getBoundingClientRect();
                        const x = e.touches[0].clientX - chatRect.left;
                        const y = e.touches[0].clientY - chatRect.top;
                        self.showContextMenu(char.id, x, y);
                    }, 500); // 500ms长按触发
                }, { passive: true });
                
                // 触摸移动（如果移动距离过大则取消长按）
                item.addEventListener('touchmove', function(e) {
                    if (longPressTimer) {
                        const moveX = Math.abs(e.touches[0].clientX - startX);
                        const moveY = Math.abs(e.touches[0].clientY - startY);
                        if (moveX > 10 || moveY > 10) {
                            clearTimeout(longPressTimer);
                            longPressTimer = null;
                        }
                    }
                }, { passive: true });
                
                // 触摸结束
                item.addEventListener('touchend', function(e) {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                    // 如果是长按，阻止点击事件
                    if (isLongPress) {
                        e.preventDefault();
                        isLongPress = false;
                    }
                });
                
                // 鼠标右键菜单（桌面端）
                item.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    const chatApp = document.getElementById('chat-app');
                    const chatRect = chatApp.getBoundingClientRect();
                    const x = e.clientX - chatRect.left;
                    const y = e.clientY - chatRect.top;
                    self.showContextMenu(char.id, x, y);
                });
                
                // 点击事件
                item.onclick = function(e) {
                    if (isLongPress) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    ChatInterface.open(char.id);
                };

                listContainer.appendChild(item);
            });
            
        } catch (err) {
            console.error('Render List Error:', err);
            listContainer.innerHTML = '<p class="text-xs text-red-500 text-center py-4">渲染列表出错</p>';
        }
    }
};
