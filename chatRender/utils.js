/**
 * chatRender/utils.js
 * 聊天渲染模块 - 工具函数
 * 
 * 包含：
 * - 文字意念传图（Canvas生成文字卡片）
 * - 图片压缩工具
 * - 滚动控制
 */

const ChatRenderUtils = {
    /**
     * 文字意念传图：用 Canvas 生成白底文字卡片图片
     * @param {string} text - 要显示的文字描述
     * @returns {string} - 生成的图片 Data URL
     */
    generateTextImageCard: function(text) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 设置画布尺寸 (正方形，大尺寸)
        const width = 500;
        const height = 500;
        canvas.width = width;
        canvas.height = height;
        
        // 绘制白色背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // 绘制淡灰色边框
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, width - 2, height - 2);
        
        // 设置文字样式
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 自动换行绘制文字
        const maxWidth = width - 80; // 左右留 40px 边距
        const lineHeight = 38;
        const fontSize = 26;
        ctx.font = fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        
        // 文字换行处理
        const words = text.split('');
        const lines = [];
        let currentLine = '';
        
        for (let i = 0; i < words.length; i++) {
            const char = words[i];
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine !== '') {
                lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        
        // 限制最大行数
        const maxLines = 11;
        if (lines.length > maxLines) {
            lines.length = maxLines;
            lines[maxLines - 1] = lines[maxLines - 1].slice(0, -3) + '...';
        }
        
        // 计算起始 Y 坐标使文字垂直居中
        const totalTextHeight = lines.length * lineHeight;
        let startY = (height - totalTextHeight) / 2 + lineHeight / 2;
        
        // 绘制每一行文字
        lines.forEach((line, index) => {
            ctx.fillText(line, width / 2, startY + index * lineHeight);
        });
        
        return canvas.toDataURL('image/png');
    },

    /**
     * 滚动到底部
     */
    scrollToBottom: function() {
        const msgContainer = document.getElementById('chat-messages');
        if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
    },

    /**
     * 聊天图片压缩 - 保持原始尺寸比例，只在过大时压缩
     * @param {string} base64 - 图片的base64数据
     * @returns {Promise<string>} - 压缩后的base64数据
     */
    compressImageForChat: function(base64) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // 最大尺寸限制为800px（保持较大尺寸以保证清晰度）
                const MAX_SIZE = 800;
                
                // 只有当图片超过最大尺寸时才缩小，保持原始比例
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
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.src = base64;
        });
    },

    /**
     * 图片压缩工具函数（通用）
     * @param {string} base64 - 图片的base64数据
     * @param {number} maxSize - 最大尺寸
     * @param {number} quality - 压缩质量 (0-1)
     * @returns {Promise<string>} - 压缩后的base64数据
     */
    compressImage: function(base64, maxSize, quality) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxSize) {
                        height *= maxSize / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = base64;
        });
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatRenderUtils;
}
