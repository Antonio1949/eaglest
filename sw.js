/* EaglesT — service worker: app disponibile anche senza rete.
 * L'app (pagina, icone, manifest) viene salvata all'installazione; le immagini satellitari
 * già viste restano disponibili offline. Le distanze non dipendono dalla mappa: i green
 * sono dentro la pagina, quindi funzionano sempre. */
const BUILD = '1cfd8ae3159a';
const APP_CACHE = 'eaglest-app-' + BUILD;
const TILE_CACHE = 'eaglest-tiles';
const TILE_HOST = 'server.arcgisonline.com';
const TILE_MAX = 1500;
const APP_FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k.startsWith('eaglest-app-') && k !== APP_CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});

async function trimTiles(cache) {
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - TILE_MAX; i++) await cache.delete(keys[i]);
}

/** Tessere satellitari: prima la rete, se manca si usa la copia già vista. */
async function tile(request) {
    const cache = await caches.open(TILE_CACHE);
    try {
        const res = await fetch(request);
        if (res.ok || res.type === 'opaque') { cache.put(request, res.clone()); trimTiles(cache); }
        return res;
    } catch {
        return (await cache.match(request)) || Response.error();
    }
}

/** File dell'app: prima la rete (aggiornamenti), se manca la copia salvata.
 * 'no-cache' chiede sempre al server se il file è cambiato: GitHub Pages dichiara 10 minuti
 * di validità e senza questo il browser restituirebbe la versione precedente. */
async function appFile(request) {
    try {
        const res = await fetch(request, { cache: 'no-cache' });
        if (res.ok) (await caches.open(APP_CACHE)).put(request, res.clone());
        return res;
    } catch {
        return (await caches.match(request, { ignoreSearch: true })) || caches.match('index.html');
    }
}

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.hostname === TILE_HOST) e.respondWith(tile(e.request));
    else if (url.origin === self.location.origin) e.respondWith(appFile(e.request));
});
