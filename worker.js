// Background thread: propagates every satellite so the sky view stays smooth on a phone.
// Messages in:  reset | add {list:[[l1,l2],...]} | obs {lat,lon,h} | tick {t} | passes {t, hours, indices, job}
// Messages out: pos {t, gen, data: Float64Array [idx, az, el, rangeKm, lit] ...} | passes {job, list}
importScripts("https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/dist/satellite.min.js");

const D2R = Math.PI / 180, R2D = 180 / Math.PI, EARTH_R = 6371;
let recs = [];
let gd = null, lat = 0, lon = 0;
let cand = null, lastScan = 0;

function sunPos(date) {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const L = (280.460 + 0.9856474 * n) * D2R;
  const g = (357.528 + 0.9856003 * n) * D2R;
  const lam = L + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
  const eps = (23.439 - 0.0000004 * n) * D2R;
  const v = { x: Math.cos(lam), y: Math.cos(eps) * Math.sin(lam), z: Math.sin(eps) * Math.sin(lam) };
  return { v, ra: Math.atan2(v.y, v.x), dec: Math.asin(v.z) };
}
function sunEl(sun, gmst) {
  const ha = gmst + lon - sun.ra;
  return Math.asin(Math.sin(sun.dec) * Math.sin(lat) + Math.cos(sun.dec) * Math.cos(lat) * Math.cos(ha)) * R2D;
}
function inShadow(p, s) {
  const d = p.x * s.x + p.y * s.y + p.z * s.z;
  if (d > 0) return false;
  const px = p.x - d * s.x, py = p.y - d * s.y, pz = p.z - d * s.z;
  return px * px + py * py + pz * pz < EARTH_R * EARTH_R;
}
function look(rec, date, gmst, sunV) {
  const pv = satellite.propagate(rec, date);
  if (!pv || !pv.position) return null;
  const la = satellite.ecfToLookAngles(gd, satellite.eciToEcf(pv.position, gmst));
  const el = la.elevation * R2D;
  if (!isFinite(el)) return null;
  return { az: ((la.azimuth * R2D) + 360) % 360, el, range: la.rangeSat, lit: !inShadow(pv.position, sunV) };
}

function tick(t, gen) {
  const out = [];
  if (gd && recs.length) {
    const date = new Date(t), gmst = satellite.gstime(date), sunV = sunPos(date).v;
    // Every 8 s scan everything; in between only recheck what was near or above the horizon.
    const full = !cand || t - lastScan > 8000 || t < lastScan;
    const next = full ? [] : null;
    const n = full ? recs.length : cand.length;
    for (let k = 0; k < n; k++) {
      const i = full ? k : cand[k], rec = recs[i];
      if (!rec) continue;
      const l = look(rec, date, gmst, sunV);
      if (!l) continue;
      if (full && l.el > -8) next.push(i);
      if (l.el > -1) out.push(i, l.az, l.el, l.range, l.lit ? 1 : 0);
    }
    if (full) { cand = Int32Array.from(next); lastScan = t; }
  }
  const data = new Float64Array(out);
  postMessage({ type: "pos", t, gen, data }, [data.buffer]);
}

let passJob = 0;
async function passes(m) {
  const job = passJob = m.job;
  if (!gd) return;
  const step = 60e3, steps = Math.round(m.hours * 60);
  const ts = [];
  for (let s = 0; s <= steps; s++) {
    const date = new Date(m.t + s * step), gmst = satellite.gstime(date), sun = sunPos(date);
    ts.push({ date, gmst, sunV: sun.v, dark: sunEl(sun, gmst) < -6 });
  }
  const list = [];
  for (let k = 0; k < m.indices.length; k++) {
    const i = m.indices[k], rec = recs[i];
    if (!rec) continue;
    let cur = null;
    for (const t of ts) {
      const l = look(rec, t.date, t.gmst, t.sunV);
      if (!l) break;
      if (l.el > 0) {
        if (!cur) cur = { idx: i, start: +t.date, startAz: l.az, maxEl: -90, visible: false };
        if (l.el > cur.maxEl) { cur.maxEl = l.el; cur.maxTime = +t.date; cur.maxAz = l.az; }
        if (l.el > 10 && l.lit && t.dark) cur.visible = true;
        cur.end = +t.date; cur.endAz = l.az;
      } else if (cur) { if (cur.maxEl >= 15) list.push(cur); cur = null; }
    }
    if (cur && cur.maxEl >= 15) list.push(cur);
    // Yield so position updates keep flowing while passes are worked out.
    if (k % 10 === 9) { await new Promise(r => setTimeout(r, 0)); if (job !== passJob) return; }
  }
  postMessage({ type: "passes", job, list });
}

onmessage = e => {
  const m = e.data;
  switch (m.type) {
    case "reset": recs = []; cand = null; break;
    case "add":
      for (const [l1, l2] of m.list) {
        let r = null;
        try { r = satellite.twoline2satrec(l1, l2); if (r.error) r = null; } catch {}
        recs.push(r);
      }
      cand = null;
      break;
    case "obs":
      lat = m.lat * D2R; lon = m.lon * D2R;
      gd = { latitude: lat, longitude: lon, height: (m.h || 0) / 1000 };
      cand = null;
      break;
    case "tick": tick(m.t, m.gen); break;
    case "passes": passes(m); break;
  }
};
