// Minimax 语音 API 代理服务器
module.exports = async function handler(req, res) {
    console.log(`[Proxy] ${req.method} ${req.url} - Headers:`, JSON.stringify(req.headers, null, 2));
    
    // 设置 CORS 头部，允许跨域访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Group-Id');
    res.setHeader('Access-Control-Max-Age', '86400');

    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
        console.log('[Proxy] OPTIONS request handled');
        return res.status(200).end();
    }

    // 处理 POST 请求
    if (req.method === 'POST') {
        try {
            var authorization = req.headers['authorization'] || req.headers['Authorization'];
            var groupId = req.headers['x-group-id'] || req.headers['X-Group-Id'];

            console.log('[Proxy] Auth:', authorization ? 'Present' : 'Missing');
            console.log('[Proxy] GroupId:', groupId ? 'Present' : 'Missing');

            if (!authorization || !groupId) {
                console.log('[Proxy] Missing required headers');
                return res.status(400).json({ error: 'Missing Authorization or X-Group-Id header' });
            }

            var minimaxUrl = 'https://api.minimax.chat/v1/text_to_speech?GroupId=' + groupId;
            console.log('[Proxy] Forwarding to:', minimaxUrl);
            console.log('[Proxy] Request body:', JSON.stringify(req.body, null, 2));

            // 使用 fetch (Node.js 18+ 内置)
            var response = await fetch(minimaxUrl, {
                method: 'POST',
                headers: {
                    'Authorization': authorization,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(req.body)
            });

            console.log('[Proxy] Minimax response status:', response.status);
            var contentType = response.headers.get('content-type');
            console.log('[Proxy] Minimax response content-type:', contentType);

            if (contentType && contentType.includes('audio/')) {
                console.log('[Proxy] Returning audio data');
                var audioBuffer = await response.arrayBuffer();
                res.setHeader('Content-Type', contentType);
                return res.status(response.status).send(Buffer.from(audioBuffer));
            } else {
                console.log('[Proxy] Returning JSON data');
                var data = await response.json();
                console.log('[Proxy] Minimax JSON response:', JSON.stringify(data, null, 2));
                return res.status(response.status).json(data);
            }

        } catch (error) {
            console.error('[Proxy] Error:', error);
            return res.status(500).json({
                error: 'Proxy server error',
                message: error.message,
                stack: error.stack
            });
        }
    }

    // 其他方法
    console.log(`[Proxy] Method ${req.method} not allowed`);
    return res.status(405).json({ error: 'Method not allowed', method: req.method });
};
