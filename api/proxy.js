// Minimax 语音 API 代理服务器
export default async function handler(req, res) {
    // 设置 CORS 头部，允许跨域访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Group-Id');
    res.setHeader('Access-Control-Max-Age', '86400');

    console.log(`[代理] 收到 ${req.method} 请求`);

    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
        console.log('[代理] 处理 OPTIONS 预检请求');
        res.status(200).end();
        return;
    }

    // 处理 POST 请求
    if (req.method === 'POST') {
        console.log('[代理] 处理 POST 请求');
        
        try {
            // 从请求头获取认证信息
            const authorization = req.headers.authorization;
            const groupId = req.headers['x-group-id'];

            console.log('[代理] Authorization:', authorization ? '已提供' : '缺失');
            console.log('[代理] X-Group-Id:', groupId ? '已提供' : '缺失');

            if (!authorization || !groupId) {
                console.log('[代理] 缺少必要头部');
                res.status(400).json({ error: 'Missing Authorization or X-Group-Id header' });
                return;
            }

            // 构建 Minimax API 请求
            const minimaxUrl = `https://api.minimax.chat/v1/text_to_speech?GroupId=${groupId}`;
            
            console.log('[代理] 转发到:', minimaxUrl);
            console.log('[代理] 请求体:', JSON.stringify(req.body, null, 2));

            const response = await fetch(minimaxUrl, {
                method: 'POST',
                headers: {
                    'Authorization': authorization,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(req.body)
            });

            console.log('[代理] Minimax API 响应状态:', response.status);

            // 检查响应类型
            const contentType = response.headers.get('content-type');
            console.log('[代理] 响应类型:', contentType);
            
            if (contentType && contentType.includes('audio/')) {
                // 音频响应 - 直接转发二进制数据
                const audioBuffer = await response.arrayBuffer();
                res.setHeader('Content-Type', contentType);
                res.status(response.status).send(Buffer.from(audioBuffer));
            } else {
                // JSON 响应
                const data = await response.json();
                console.log('[代理] Minimax API 响应数据:', JSON.stringify(data, null, 2));
                res.status(response.status).json(data);
            }

        } catch (error) {
            console.error('[代理] 服务器错误:', error);
            res.status(500).json({
                error: 'Proxy server error',
                message: error.message
            });
        }
        return;
    }

    // 其他方法不支持
    console.log(`[代理] 不支持的方法: ${req.method}`);
    res.status(405).json({
        error: 'Method not allowed',
        allowed: ['POST', 'OPTIONS'],
        received: req.method
    });
}