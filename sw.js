// Offline support: keeps the app and its library on the phone so it opens without signal.
//  - App files: fetched fresh when online (so updates arrive), the saved copy is used when offline
//    or when the network takes longer than 4 seconds.
//  - Fonts: the saved copy first.
//  - Satellite data (data/*), CelesTrak and lookups: left to the page, which keeps its own copies.
// Bump VERSION when the list of app files changes.
const VERSION = "overhead-v3";
const APP = ["./", "index.html", "worker.js", "codes.js", "sky-data.js", "model3d.js", "lib/satellite.min.js", "manifest.webmanifest",
  "icon.svg", "icon-180.png", "icon-512.png", "tle-fallback.txt"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => /^overhead-v\d+$/.test(k) && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") { e.respondWith(savedFirst(req)); return; }
  if (url.origin !== location.origin || url.pathname.includes("/data/")) return;
  e.respondWith(freshFirst(req));
});

async function savedFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") (await caches.open(VERSION)).put(req, res.clone());
  return res;
}

async function freshFirst(req) {
  const cache = await caches.open(VERSION);
  const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
  net.catch(() => {});
  const slow = new Promise(resolve => setTimeout(resolve, 4000, null));
  try { const res = await Promise.race([net, slow]); if (res) return res; } catch {}
  const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await cache.match("index.html") : null);
  return hit || net;   // nothing saved yet: keep waiting for the network
}
