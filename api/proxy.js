// Minimax 语音 API 代理服务器
export default async function handler(req, res) {
    // 设置 CORS 头部，允许跨域访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Group-Id');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24小时缓存预检请求

    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 只允许 POST 请求
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        // 从请求头获取认证信息
        const authorization = req.headers.authorization;
        const groupId = req.headers['x-group-id'];

        if (!authorization || !groupId) {
            res.status(400).json({ error: 'Missing Authorization or X-Group-Id header' });
            return;
        }

        // 构建 Minimax API 请求
        const minimaxUrl = `https://api.minimax.chat/v1/text_to_speech?GroupId=${groupId}`;
        
        console.log('代理转发到:', minimaxUrl);
        console.log('请求体:', JSON.stringify(req.body, null, 2));

        const response = await fetch(minimaxUrl, {
            method: 'POST',
            headers: {
                'Authorization': authorization,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        console.log('Minimax API 响应状态:', response.status);

        // 检查响应类型
        const contentType = response.headers.get('content-type');
        console.log('响应类型:', contentType);
        
        if (contentType && contentType.includes('audio/')) {
            // 音频响应 - 直接转发二进制数据
            const audioBuffer = await response.arrayBuffer();
            res.setHeader('Content-Type', contentType);
            res.status(response.status).send(Buffer.from(audioBuffer));
        } else {
            // JSON 响应
            const data = await response.json();
            console.log('Minimax API 响应数据:', JSON.stringify(data, null, 2));
            res.status(response.status).json(data);
        }

    } catch (error) {
        console.error('代理服务器错误:', error);
        res.status(500).json({ 
            error: 'Proxy server error', 
            message: error.message 
        });
    }
}