// GitHub分片恢复功能扩展
// 将此代码添加到settings.js的githubRestore函数中

async function githubRestoreWithChunks() {
    const token = document.getElementById('github-token').value.trim();
    const repo = document.getElementById('github-repo').value.trim();
    const filename = document.getElementById('github-filename').value.trim() || 'rurichat_backup.json';

    if (!token) {
        alert('请输入GitHub Token');
        return;
    }
    if (!repo) {
        alert('请输入仓库路径');
        return;
    }

    if (!confirm('⚠️ 恢复数据将覆盖当前所有数据，确定继续吗？')) {
        return;
    }

    const btn = document.querySelector('button[onclick="SettingsManager.githubRestore()"]');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 检查备份...';
    btn.disabled = true;

    try {
        // 先检查是否有索引文件（分片备份）
        const indexFilename = filename.replace('.json', '_index.json');
        const indexResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${indexFilename}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (indexResponse.ok) {
            // 分片备份，需要下载并合并所有分片
            console.log('[恢复] 检测到分片备份');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 读取索引...';
            
            const indexFileInfo = await indexResponse.json();
            const indexContent = atob(indexFileInfo.content.replace(/\n/g, ''));
            const indexData = JSON.parse(indexContent);
            
            console.log('[恢复] 总共', indexData.totalChunks, '个分片');
            
            // 下载所有分片
            let fullData = '';
            for (let i = 1; i <= indexData.totalChunks; i++) {
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 下载分片 ' + i + '/' + indexData.totalChunks;
                const chunkFilename = filename.replace('.json', '_part' + i + '.json');
                
                const chunkResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${chunkFilename}`, {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                if (!chunkResponse.ok) {
                    throw new Error('下载分片' + i + '失败');
                }
                
                const chunkFileInfo = await chunkResponse.json();
                const base64Content = chunkFileInfo.content.replace(/\n/g, '');
                const binaryString = atob(base64Content);
                const bytes = new Uint8Array(binaryString.length);
                for (let j = 0; j < binaryString.length; j++) {
                    bytes[j] = binaryString.charCodeAt(j);
                }
                const chunkData = new TextDecoder().decode(bytes);
                fullData += chunkData;
                
                console.log('[恢复] 已下载分片', i, '/', indexData.totalChunks);
            }
            
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 解析数据...';
            const backupData = JSON.parse(fullData);
            
            // 恢复数据
            await restoreBackupData(backupData);
            
        } else {
            // 单文件备份 - 使用原有逻辑
            console.log('[恢复] 单文件备份');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 下载备份...';
            
            const response = await fetch(`https://api.github.com/repos/${repo}/contents/${filename}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('备份文件不存在');
                }
                const error = await response.json();
                throw new Error(error.message || '获取文件失败');
            }

            const fileInfo = await response.json();
            const base64Content = fileInfo.content.replace(/\n/g, '');
            const binaryString = atob(base64Content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const decodedContent = new TextDecoder().decode(bytes);
            const backupData = JSON.parse(decodedContent);
            
            await restoreBackupData(backupData);
        }

    } catch (error) {
        console.error('[恢复错误]', error);
        alert('❌ 恢复失败：' + error.message);
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

// 恢复备份数据的通用函数
async function restoreBackupData(backupData) {
    if (backupData.localStorage && backupData.indexedDB) {
        // 新格式：恢复 localStorage
        localStorage.clear();
        Object.keys(backupData.localStorage).forEach(key => {
            localStorage.setItem(key, backupData.localStorage[key]);
        });
        
        // 恢复 IndexedDB
        const dbNames = Object.keys(backupData.indexedDB);
        for (const dbName of dbNames) {
            try {
                console.log('[恢复] 正在导入', dbName);
                await SettingsManager.importIndexedDB(dbName, backupData.indexedDB[dbName]);
                console.log('[恢复] 成功导入', dbName);
            } catch (e) {
                console.error('[恢复] 导入失败', dbName, e);
                alert('恢复 ' + dbName + ' 失败: ' + e.message);
            }
        }
        
        alert('✅ 数据恢复成功！\\n\\n页面将自动刷新以应用新数据。');
    } else {
        // 旧格式：只恢复 localStorage
        localStorage.clear();
        Object.keys(backupData).forEach(key => {
            localStorage.setItem(key, backupData[key]);
        });
        alert('✅ 数据恢复成功！\\n\\n页面将自动刷新以应用新数据。');
    }

    location.reload();
}
