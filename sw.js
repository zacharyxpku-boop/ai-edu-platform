/* 原点智学 — 极简 SW v1
   目标：满足 PWA installability + 离线可见基础首页
   策略：
   - 导航请求 (HTML) → network-first，失败回落缓存，再失败给离线占位
   - 静态资源 (src/*, /*.js, /*.css) → cache-first，后台更新
   - 其余 → 直通网络
*/
const VER = 'ydzx-v1-2026-04-21';
const CORE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(VER).then((c) => c.addAll(CORE)).catch(() => {}));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VER).map((k) => caches.delete(k))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== location.origin) return;
    // 不缓存 API
    if (url.pathname.startsWith('/api/')) return;

    // 导航 / HTML
    if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
        e.respondWith(
            fetch(req).then((res) => {
                const copy = res.clone();
                caches.open(VER).then((c) => c.put(req, copy)).catch(() => {});
                return res;
            }).catch(() => caches.match(req).then((r) => r || caches.match('/index.html')))
        );
        return;
    }

    // 静态：cache-first + 后台刷新
    if (/\.(?:js|css|woff2?|ttf|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)) {
        e.respondWith(
            caches.match(req).then((hit) => {
                const netP = fetch(req).then((res) => {
                    if (res && res.status === 200) {
                        const copy = res.clone();
                        caches.open(VER).then((c) => c.put(req, copy)).catch(() => {});
                    }
                    return res;
                }).catch(() => hit);
                return hit || netP;
            })
        );
    }
});
