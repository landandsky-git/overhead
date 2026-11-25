// Background thread: propagates every satellite so the sky view stays smooth on a phone.
// Messages in:  reset | add {list:[[l1,l2,stdMag],...]} | obs {lat,lon,h} | tick {t, gen}
//               passes {t, hours, indices, limit, job} | lookback {t0, t1, step, dir, radius, job}
//               mags {list: [[idx, stdMag], ...]}
// Messages out: pos {t, gen, data: Float64Array [idx, az, el, rangeKm, lit, mag, az+1s, el+1s] ...} | passes {job, list}
//               lookback {job, hits: [{idx, t, deg, lit, mag, from, to}]}
// The page normally starts this worker with the orbit library already bundled in front of it,
// which also works offline; loaded on its own, it fetches the library itself.
if (typeof satellite === "undefined") importScripts("lib/satellite.min.js");

const D2R = Math.PI / 180, R2D = 180 / Math.PI, EARTH_R = 6371;
let recs = [], mags = [];
let gd = null, lat = 0, lon = 0;
let cand = null, lastScan = 0;

function sunPos(date) {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const L = (280.460 + 0.9856474 * n) * D2R;
  const g = (357.528 + 0.9856003 * n) * D2R;
  const lam = L + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
  const eps = (23.439 - 0.0000004 * n) * D2R;
  const v = { x: Math.cos(lam), y: Math.cos(eps) * Math.sin(lam), z: Math.sin(eps) * Math.sin(lam) };
  return { v, lam, ra: Math.atan2(v.y, v.x), dec: Math.asin(v.z) };
}
// The Moon's height above the horizon and lit fraction (low-precision series, as in the page).
function moonAt(date, gmst, sun) {
  const T = (date.getTime() / 86400000 + 2440587.5 - 2451545) / 36525, s = d => Math.sin(d * D2R);
  const mLon = (218.32 + 481267.881 * T + 6.29 * s(135.0 + 477198.87 * T) - 1.27 * s(259.3 - 413335.36 * T)
    + 0.66 * s(235.7 + 890534.22 * T) + 0.21 * s(269.9 + 954397.74 * T) - 0.19 * s(357.5 + 35999.05 * T) - 0.11 * s(186.5 + 966404.03 * T)) * D2R;
  const mLat = (5.13 * s(93.3 + 483202.02 * T) + 0.28 * s(228.2 + 960400.89 * T) - 0.28 * s(318.3 + 6003.15 * T) - 0.17 * s(217.6 - 407332.21 * T)) * D2R;
  const eps = (23.439 - 0.013 * T) * D2R, x = Math.cos(mLat) * Math.cos(mLon), y = Math.cos(mLat) * Math.sin(mLon), z = Math.sin(mLat);
  const ra = Math.atan2(y * Math.cos(eps) - z * Math.sin(eps), x), dec = Math.asin(y * Math.sin(eps) + z * Math.cos(eps));
  const ha = gmst + lon - ra;   // lon, lat: the observer
  const el = Math.asin(Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha)) * R2D;
  return { el, lit: (1 - Math.cos(mLat) * Math.cos(mLon - sun.lam)) / 2 };
}
// Faintest magnitude visible: the viewer's sky, less twilight and moonlight (same rule as the page).
function skyLimit(base, sunElDeg, moon) {
  const twilight = Math.pow(Math.min(1, Math.max(0, (sunElDeg + 18) / 12)), 1.5) * 3.5;
  const ml = moon.el > 0 ? Math.pow(moon.lit, 1.5) * Math.max(0, base - 3) * 0.5 * Math.min(1, moon.el / 20) : 0;
  return base - twilight - ml;
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
// Apparent magnitude: standard magnitude, scaled for distance, how much of the lit side faces us
// (diffuse sphere), and haze near the horizon.
function magnitude(m0, p, sunV, obs, range, el) {
  const ox = obs.x - p.x, oy = obs.y - p.y, oz = obs.z - p.z, d = Math.hypot(ox, oy, oz);
  const phi = Math.acos(Math.max(-1, Math.min(1, (sunV.x * ox + sunV.y * oy + sunV.z * oz) / d)));
  const F = Math.sin(phi) + (Math.PI - phi) * Math.cos(phi);
  const s = Math.sin(Math.max(el, 0.5) * D2R), airmass = 1 / (s + 0.025 * Math.exp(-11 * s));
  return Math.min(15, m0 + 5 * Math.log10(range / 1000) - 2.5 * Math.log10(Math.max(F, 1e-3)) + 0.2 * (airmass - 1));
}
const observerEci = gmst => satellite.ecfToEci(satellite.geodeticToEcf(gd), gmst);

function look(i, date, gmst, sunV, obs) {
  const pv = satellite.propagate(recs[i], date);
  if (!pv || !pv.position) return null;
  const la = satellite.ecfToLookAngles(gd, satellite.eciToEcf(pv.position, gmst));
  const el = la.elevation * R2D;
  if (!isFinite(el)) return null;
  const lit = !inShadow(pv.position, sunV);
  return { az: ((la.azimuth * R2D) + 360) % 360, el, range: la.rangeSat, lit,
           mag: lit && el > -1 ? magnitude(mags[i], pv.position, sunV, obs, la.rangeSat, el) : 99 };
}

// Direction one second later, so the page can glide each dot smoothly between updates.
function azElAt(i, date, gmst) {
  const pv = satellite.propagate(recs[i], date);
  if (!pv || !pv.position) return null;
  const la = satellite.ecfToLookAngles(gd, satellite.eciToEcf(pv.position, gmst));
  return [la.azimuth * R2D, la.elevation * R2D];
}

function tick(t, gen) {
  const out = [];
  if (gd && recs.length) {
    const date = new Date(t), gmst = satellite.gstime(date), sunV = sunPos(date).v, obs = observerEci(gmst);
    const date2 = new Date(t + 1000), gmst2 = satellite.gstime(date2);
    // Every 8 s scan everything; in between only recheck what was near or above the horizon.
    const full = !cand || t - lastScan > 8000 || t < lastScan;
    const next = full ? [] : null;
    const n = full ? recs.length : cand.length;
    for (let k = 0; k < n; k++) {
      const i = full ? k : cand[k];
      if (!recs[i]) continue;
      const l = look(i, date, gmst, sunV, obs);
      if (!l) continue;
      if (full && l.el > -8) next.push(i);
      if (l.el > -1) {
        const n = azElAt(i, date2, gmst2) || [l.az, l.el];
        out.push(i, l.az, l.el, l.range, l.lit ? 1 : 0, l.mag, n[0], n[1]);
      }
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
    const se = sunEl(sun, gmst);
    ts.push({ date, gmst, sunV: sun.v, obs: observerEci(gmst), dark: se < -6, limit: se < -6 ? skyLimit(m.limit || 6, se, moonAt(date, gmst, sun)) : -99 });
  }
  const list = [];
  for (let k = 0; k < m.indices.length; k++) {
    const i = m.indices[k];
    if (!recs[i]) continue;
    let cur = null;
    for (const t of ts) {
      const l = look(i, t.date, t.gmst, t.sunV, t.obs);
      if (!l) break;
      if (l.el > 0) {
        if (!cur) cur = { idx: i, start: +t.date, startAz: l.az, maxEl: -90, visible: false, mag: 99 };
        if (l.el > cur.maxEl) { cur.maxEl = l.el; cur.maxTime = +t.date; cur.maxAz = l.az; }
        if (l.el > 10 && l.lit && t.dark) {
          if (l.mag < cur.mag) { cur.mag = l.mag; cur.limit = t.limit; }
          if (l.mag < t.limit) cur.visible = true;
        }
        cur.end = +t.date; cur.endAz = l.az;
      } else if (cur) { if (cur.maxEl >= 15) list.push(cur); cur = null; }
    }
    if (cur && cur.maxEl >= 15) list.push(cur);
    // Yield so position updates keep flowing while passes are worked out.
    if (k % 10 === 9) { await new Promise(r => setTimeout(r, 0)); if (job !== passJob) return; }
  }
  postMessage({ type: "passes", job, list });
}

// "What was that?": which satellites crossed a direction on the sky (dir, unit east/north/up vector)
// within `radius` degrees between t0 and t1. Each satellite's path is checked every `step` ms, with the
// closest approach found along each step, so fast movers between samples aren't missed.
function lookback(m) {
  const cosR = Math.cos(m.radius * D2R), [px, py, pz] = m.dir, ts = [];
  for (let t = m.t0; t <= m.t1; t += m.step) {
    const d = new Date(t), g = satellite.gstime(d), s = sunPos(d);
    ts.push({ t, d, g, sunV: s.v, obs: satellite.ecfToEci(satellite.geodeticToEcf(gd), g) });
  }
  const hits = [];
  for (let i = 0; i < recs.length; i++) {
    if (!recs[i]) continue;
    let prev = null, best = null;
    for (const T of ts) {
      const pv = satellite.propagate(recs[i], T.d);
      if (!pv || !pv.position) { prev = null; continue; }
      const la = satellite.ecfToLookAngles(gd, satellite.eciToEcf(pv.position, T.g));
      const ce = Math.cos(la.elevation), v = [Math.sin(la.azimuth) * ce, Math.cos(la.azimuth) * ce, Math.sin(la.elevation)];
      const cur = { T, v, pv, range: la.rangeSat, el: la.elevation * R2D };
      if (prev) {
        // closest point to dir on the short chord prev -> cur
        const dx = v[0] - prev.v[0], dy = v[1] - prev.v[1], dz = v[2] - prev.v[2], L2 = dx * dx + dy * dy + dz * dz;
        const f = L2 > 0 ? Math.max(0, Math.min(1, ((px - prev.v[0]) * dx + (py - prev.v[1]) * dy + (pz - prev.v[2]) * dz) / L2)) : 0;
        const q = [prev.v[0] + f * dx, prev.v[1] + f * dy, prev.v[2] + f * dz], qn = Math.hypot(...q);
        const c = (q[0] * px + q[1] * py + q[2] * pz) / qn;
        if (c > cosR && q[2] > 0 && (!best || c > best.c)) best = { c, f, a: prev, b: cur };
      }
      prev = cur;
    }
    if (!best) continue;
    const near = best.f < 0.5 ? best.a : best.b;   // the nearer sample for sunlight and brightness
    const lit = !inShadow(near.pv.position, near.T.sunV);
    hits.push({ idx: i, t: best.a.T.t + best.f * (best.b.T.t - best.a.T.t), deg: Math.acos(Math.min(1, best.c)) * R2D, lit,
                mag: lit ? magnitude(mags[i], near.pv.position, near.T.sunV, near.T.obs, near.range, near.el) : 99,
                from: best.a.v, to: best.b.v });
  }
  // What someone most likely noticed: sunlit and bright first, then close to where they point
  // (4 degrees off counts about as much as one magnitude fainter), then recent (10 minutes ago
  // counts as one magnitude), since people usually ask right after seeing it.
  const score = h => h.lit ? h.mag + h.deg / 4 + (m.t1 - h.t) / 600e3 : 100 + h.deg;
  hits.sort((a, b) => score(a) - score(b));
  postMessage({ type: "lookback", job: m.job, hits: hits.slice(0, 40) });
}

onmessage = e => {
  const m = e.data;
  switch (m.type) {
    case "reset": recs = []; mags = []; cand = null; break;
    case "add":
      for (const [l1, l2, m0] of m.list) {
        let r = null;
        try { r = satellite.twoline2satrec(l1, l2); if (r.error) r = null; } catch {}
        recs.push(r); mags.push(m0);
      }
      cand = null;
      break;
    case "mags":   // brightness corrections from the viewer's sightings: [[idx, stdMag], ...]
      for (const [i, m0] of m.list) mags[i] = m0;
      break;
    case "obs":
      lat = m.lat * D2R; lon = m.lon * D2R;
      gd = { latitude: lat, longitude: lon, height: (m.h || 0) / 1000 };
      cand = null;
      break;
    case "tick": tick(m.t, m.gen); break;
    case "passes": passes(m); break;
    case "lookback": lookback(m); break;
  }
};
