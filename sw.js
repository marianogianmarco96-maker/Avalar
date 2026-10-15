const VERSION = '1792091153';
const CORE = ['./', 'index.html', 'local.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'data.json', 'data.enc'];
const CACHE = 'campagna-' + VERSION, FONTS = 'campagna-fonts';
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => { })));
    try {
      const d = await (await c.match('data.json')).json();
      const files = [...new Set(Object.values(d.blobmap || {}))];
      for (let i = 0; i < files.length; i += 6) await Promise.all(files.slice(i, i + 6).map(u => c.add(u).catch(() => { })));
    } catch { }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k !== FONTS) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(FONTS), hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })());
    return;
  }
  if (url.origin !== location.origin) return;
  const core = req.mode === 'navigate' || /\/(index\.html|local\.js|data\.json|data\.enc|manifest\.webmanifest)?$/.test(url.pathname);
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (core) {
      try { const r = await fetch(req); if (r.ok) c.put(req.mode === 'navigate' ? './' : req, r.clone()); return r; }
      catch { return (await c.match(req, { ignoreSearch: true })) || (await c.match('./')) || Response.error(); }
    }
    const hit = await c.match(req);
    if (hit) return hit;
    try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; } catch { return Response.error(); }
  })());
});
