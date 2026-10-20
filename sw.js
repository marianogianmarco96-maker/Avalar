const VERSION = '1792490000';
const CORE = ['./', 'index.html', 'local.js', 'idee.js', 'manuali.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'data.json', 'data.enc'];
const CACHE = 'campagna-' + VERSION, FONTS = 'campagna-fonts';
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => { })));
    // le immagini non si scaricano tutte in anticipo (sono molti MB su rete mobile):
    // vengono salvate per l'uso offline la prima volta che si aprono
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = await caches.open(CACHE);
    for (const k of await caches.keys()) {
      if (k === CACHE || k === FONTS) continue;
      if (k.startsWith('campagna-')) { const old = await caches.open(k); for (const r of await old.keys()) if (/\/(blobs|priv)\//.test(r.url) && !(await keep.match(r))) await keep.put(r, await old.match(r)); }
      await caches.delete(k);
    }
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
  const core = req.mode === 'navigate' || /\/(index\.html|local\.js|idee\.js|manuali\.js|data\.json|data\.enc|giocatori\/[a-z0-9-]+\.enc|manifest\.webmanifest)?$/.test(url.pathname);
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (core) {
      // chiede sempre al server se il file è cambiato, invece di usare la copia del browser (GitHub Pages la tiene 10 minuti)
      try { const r = await fetch(req.mode === 'navigate' ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(req, { cache: 'no-cache' })); if (r.ok) c.put(req.mode === 'navigate' ? './' : req, r.clone()); return r; }
      catch { return (await c.match(req, { ignoreSearch: true })) || (await c.match('./')) || Response.error(); }
    }
    const hit = await c.match(req);
    if (hit) return hit;
    try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; } catch { return Response.error(); }
  })());
});
