/**
 * 验证所有 Minimax API 引用都已更新为代理地址
 */
console.log('=== Minimax 代理地址验证 ===');

// 检查 MinimaxVoiceAPI 配置
if (typeof MinimaxVoiceAPI !== 'undefined') {
    console.log('✅ MinimaxVoiceAPI 已加载');
    console.log('端点配置:', MinimaxVoiceAPI.endpoints);
    
    // 检查所有端点是否都使用代理地址
    const endpoints = MinimaxVoiceAPI.endpoints;
    const proxyUrl = 'https://rurichat.vercel.app/proxy';
    let allCorrect = true;
    
    for (const [version, url] of Object.entries(endpoints)) {
        if (url !== proxyUrl) {
            console.error(`❌ ${version} 版本仍使用旧地址: ${url}`);
            allCorrect = false;
        } else {
            console.log(`✅ ${version} 版本已更新: ${url}`);
        }
    }
    
    if (allCorrect) {
        console.log('🎉 所有端点都已正确更新为代理地址！');
    } else {
        console.error('❌ 仍有端点使用旧地址，请检查代码');
    }
} else {
    console.error('❌ MinimaxVoiceAPI 未加载');
}

// 测试语音合成（如果有配置）
const testConfig = localStorage.getItem('minimaxVoiceConfig');
if (testConfig) {
    console.log('📋 当前配置:', JSON.parse(testConfig));
} else {
    console.log('⚠️ 未找到 Minimax 配置');
}

console.log('=== 验证完成 ===');