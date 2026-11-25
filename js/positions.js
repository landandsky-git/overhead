// Overhead: The background worker that tracks every satellite.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// ---------- background worker ----------
// Built from the orbit library plus worker.js, both fetched through the offline cache, so it also
// starts without signal. Messages sent before it is ready wait in a queue.
const worker = { real: null, queue: [], postMessage(m) { if (this.real) this.real.postMessage(m); else this.queue.push(m); } };
let tickBusy = false, tickSent = 0;
async function startWorker() {
  let w;
  try {
    const [lib, src] = await Promise.all(["lib/satellite.min.js", "worker.js"].map(u =>
      fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.text(); })));
    w = new Worker(URL.createObjectURL(new Blob([lib, "\n;\n", src], { type: "text/javascript" })));
  } catch { w = new Worker("worker.js"); }
  w.onmessage = e => {
    const m = e.data;
    if (m.type === "pos") { tickBusy = false; if (m.gen === S.gen) applyPositions(m.data, m.t); }
    else if (m.type === "passes" && m.job === S.passJob) applyPasses(m.list);
    else if (m.type === "lookback") applyLookback(m);
    else if (m.type === "eci") applyGlobePositions(m);
  };
  w.onerror = () => { S.loading = tl("The satellite calculator didn't start. Reload the page.", "Die Satellitenberechnung ist nicht gestartet. Lade die Seite neu."); updateStatus(); };
  worker.real = w;
  for (const m of worker.queue.splice(0)) w.postMessage(m);
}
startWorker();

function requestTick() {
  if (document.hidden || GLOBE.on) return;   // the 3D globe covers the sky and asks for its own positions
  if (tickBusy && Date.now() - tickSent < 3000) return;
  tickBusy = true; tickSent = Date.now();
  worker.postMessage({ type: "tick", t: simNow(), gen: S.gen });
}
function sendObs() { if (S.loc) worker.postMessage({ type: "obs", lat: S.loc.lat, lon: S.loc.lon, h: S.loc.h || 0 }); }
function sendSkyline() { worker.postMessage({ type: "skyline", heights: skyline }); }

function applyPositions(d, t) {
  const now = [], map = new Map();
  for (let k = 0; k < d.length; k += 8) {
    const sat = S.sats[d[k]];
    if (!sat) continue;
    const e = { sat, t, az: d[k + 1], el: d[k + 2], range: d[k + 3], lit: d[k + 4] === 1, mag: d[k + 5],
                v: enu(d[k + 1], d[k + 2]), v1: enu(d[k + 6], d[k + 7]) };
    now.push(e); map.set(sat.idx, e);
  }
  S.now = now; S.nowMap = map;
}
// Where a satellite is at this instant: glide from its last computed position toward where it will be 1 s later.
function vNow(e, now) {
  const f = Math.min(3, (now - e.t) / 1000), a = e.v, b = e.v1;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

// Passes are worked out for the bright list plus anything else bright enough to be worth going out
// for (typical brightness 5 or brighter, which includes freshly launched Starlink trains).
function requestPasses() {
  const indices = S.sats.filter(s => s.cat === "bright" || s.m0 <= 5 || S.favs.has(s.id)).map(s => s.idx);
  S.passesAt = Date.now();
  worker.postMessage({ type: "passes", t: Date.now(), hours: 14, indices, limit: S.limit, job: ++S.passJob });
}
function applyPasses(list) {
  S.passes = list.map(p => ({ ...p, sat: S.sats[p.idx] })).filter(p => p.sat)
    .sort((a, b) => (b.visible - a.visible) || (a.start - b.start));
  if (S.tab === "passes" || S.tab === "tonight") renderSheet();
}
