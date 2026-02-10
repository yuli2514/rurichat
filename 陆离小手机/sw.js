// 最简单的 Service Worker，仅用于满足 PWA 安装要求
self.addEventListener('install', (event) => {
    self.skipWaiting(); // 立即激活
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim()); // 立即接管控制权
});

self.addEventListener('fetch', (event) => {
    // 直接透传请求，不做特殊缓存处理
    event.respondWith(fetch(event.request));
});
