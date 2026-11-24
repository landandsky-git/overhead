// Overhead: Astronomy: Sun, Moon, planets, stars, and single-satellite calculations.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// ---------- astronomy ----------
function jd(date) { return date.getTime() / 86400000 + 2440587.5; }
function sunPos(date) {
  const n = jd(date) - 2451545.0;
  const L = (280.460 + 0.9856474 * n) * D2R;
  const g = (357.528 + 0.9856003 * n) * D2R;
  const lam = L + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
  const eps = (23.439 - 0.0000004 * n) * D2R;
  const v = { x: Math.cos(lam), y: Math.cos(eps) * Math.sin(lam), z: Math.sin(eps) * Math.sin(lam) };
  return { v, lam, ra: Math.atan2(v.y, v.x), dec: Math.asin(v.z) };
}
function raDecToAltAz(ra, dec, gmst, lat, lon) {
  const ha = gmst + lon - ra;
  const el = Math.asin(Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha) * Math.cos(dec), Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(ha));
  return { az: ((az * R2D) + 360) % 360, el: el * R2D };
}
const EARTH_R = 6371;
function inShadow(p, s) {
  const d = p.x * s.x + p.y * s.y + p.z * s.z;
  if (d > 0) return false;
  const px = p.x - d * s.x, py = p.y - d * s.y, pz = p.z - d * s.z;
  return px * px + py * py + pz * pz < EARTH_R * EARTH_R;
}
function observerGd() { return { latitude: S.loc.lat * D2R, longitude: S.loc.lon * D2R, height: (S.loc.h || 0) / 1000 }; }
const observerEci = gmst => satellite.ecfToEci(satellite.geodeticToEcf(observerGd()), gmst);
// Apparent magnitude (same model as worker.js): standard magnitude, scaled for distance,
// how much of the lit side faces us (diffuse sphere), and haze near the horizon.
function magnitude(m0, p, sunV, obs, range, el) {
  const ox = obs.x - p.x, oy = obs.y - p.y, oz = obs.z - p.z, d = Math.hypot(ox, oy, oz);
  const phi = Math.acos(Math.max(-1, Math.min(1, (sunV.x * ox + sunV.y * oy + sunV.z * oz) / d)));
  const F = Math.sin(phi) + (Math.PI - phi) * Math.cos(phi);
  const s = Math.sin(Math.max(el, 0.5) * D2R), airmass = 1 / (s + 0.025 * Math.exp(-11 * s));
  return Math.min(15, m0 + 5 * Math.log10(range / 1000) - 2.5 * Math.log10(Math.max(F, 1e-3)) + 0.2 * (airmass - 1));
}
// How faint you can see depends on your sky (Settings): about magnitude 3.5 in a city centre,
// 4.5 in a suburb, 5.5 in a village and 6.5 in dark countryside. S.limit holds that limit.
const SKY_LIMITS = [[3.5, "City"], [4.5, "Suburb"], [5.5, "Village"], [6.5, "Dark countryside"]];
// What you can actually see right now is less: twilight and moonlight brighten the sky. Twilight takes
// up to 3.5 magnitudes off between the Sun 18 and 6 degrees below the horizon; a full Moon high up
// takes off up to half of what your sky gains over a city's (the darker your sky, the more it loses).
function skyLimitAt(sunEl, moonEl, moonLit) {
  const twilight = Math.pow(Math.min(1, Math.max(0, (sunEl + 18) / 12)), 1.5) * 3.5;
  const moon = moonEl > 0 ? Math.pow(moonLit, 1.5) * Math.max(0, S.limit - 3) * 0.5 * Math.min(1, moonEl / 20) : 0;
  return Math.round((S.limit - twilight - moon) * 10) / 10;
}
const limitNow = () => sky.moon ? skyLimitAt(sky.sunEl, sky.moon.el, sky.moon.lit) : S.limit;
// Sun and Moon at any moment, and how faint you can see then.
function conditionsAt(t) {
  const d = new Date(t), g = satellite.gstime(d), s = sunPos(d), lat = S.loc.lat * D2R, lon = S.loc.lon * D2R;
  const sunEl = raDecToAltAz(s.ra, s.dec, g, lat, lon).el, mo = moonPos(d), ma = raDecToAltAz(mo.ra, mo.dec, g, lat, lon);
  const moonLit = (1 - Math.cos(mo.lat) * Math.cos(mo.lon - s.lam)) / 2, moonEl = ma.el - mo.parallax * Math.cos(ma.el * D2R);
  return { sunEl, moonEl, moonLit, limit: skyLimitAt(sunEl, moonEl, moonLit) };
}
// "down to magnitude 3.9 (Moon 70% lit)": the limit and what is taking it below your sky setting
function seeingText(c) {
  const why = [];
  if (c.sunEl > -15) why.push("twilight");
  if (c.moonEl > 0 && c.moonLit > 0.25 && S.limit > 3.5) why.push(`Moon ${Math.round(c.moonLit * 100)}% lit`);
  return `down to magnitude ${c.limit.toFixed(1)}${why.length ? ` (${why.join(", ")})` : ""}`;
}
function brightWord(mag, L = limitNow()) {
  return mag < L - 5 ? "very bright" : mag < L - 3 ? "bright" : mag < L - 1.5 ? "easy to see"
    : mag < L ? "faint, but visible from your sky" : "too faint to see from your sky";
}
function enu(az, el) { az *= D2R; el *= D2R; return [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)]; }

// Ecliptic <-> equatorial coordinates (radians); J2000 obliquity unless given.
const OBLIQUITY = 23.43928 * D2R;
function eclToEq(lon, lat, eps = OBLIQUITY) {
  const x = Math.cos(lat) * Math.cos(lon), y = Math.cos(lat) * Math.sin(lon), z = Math.sin(lat);
  return { ra: Math.atan2(y * Math.cos(eps) - z * Math.sin(eps), x), dec: Math.asin(y * Math.sin(eps) + z * Math.cos(eps)) };
}
function eqToEcl(ra, dec, eps = OBLIQUITY) {
  const x = Math.cos(dec) * Math.cos(ra), y = Math.cos(dec) * Math.sin(ra), z = Math.sin(dec);
  return { lon: Math.atan2(y * Math.cos(eps) + z * Math.sin(eps), x), lat: Math.asin(-y * Math.sin(eps) + z * Math.cos(eps)) };
}
// Earth's axis slowly wobbles, shifting star coordinates by about 0.37 degrees since 2000.
// Star and planet positions are for 2000 and get this shift so they line up with the real sky.
const precession = date => (jd(date) - 2451545) / 365.25 * 50.29 / 3600 * D2R;
function precess(ra, dec, date) { const e = eqToEcl(ra, dec); return eclToEq(e.lon + precession(date), e.lat); }

// Planet orbits: [a (AU), e, inclination, mean longitude, longitude of perihelion, longitude of node]
// at 2000 and their change per century (JPL "Approximate Positions of the Planets", valid 1800-2050).
// Brightness: absolute magnitude plus a phase term (Mallama & Hilton 2018, simplified).
const EARTH_ORBIT = [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]];
const PLANETS = [
  ["Mercury", [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]], -0.42, a => 0.0380 * a - 0.000273 * a * a + 0.000002 * a * a * a],
  ["Venus", [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]], -4.40, a => 0.0009 * a + 0.000239 * a * a - 0.00000065 * a * a * a],
  ["Mars", [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]], -1.52, a => 0.016 * a],
  ["Jupiter", [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]], -9.40, a => 0.005 * a],
  ["Saturn", [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]], -8.88, a => 0.044 * a],
];
// Heliocentric ecliptic position (AU) from orbital elements, T in centuries since 2000.
function heliocentric([el, rate], T) {
  const [a, e, inc, L, peri, node] = el.map((v, i) => v + rate[i] * T);
  const M = (((L - peri) % 360 + 540) % 360 - 180) * D2R, w = (peri - node) * D2R, O = node * D2R, I = inc * D2R;
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  return [(cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
          (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
          (sw * sI) * xp + (cw * sI) * yp];
}
function planetPositions(date) {
  const T = (jd(date) - 2451545) / 36525, earth = heliocentric(EARTH_ORBIT, T), R = Math.hypot(...earth);
  return PLANETS.map(([name, orbit, H, phase]) => {
    const p = heliocentric(orbit, T), g = [p[0] - earth[0], p[1] - earth[1], p[2] - earth[2]];
    const r = Math.hypot(...p), d = Math.hypot(...g);
    const alpha = Math.acos(Math.max(-1, Math.min(1, (r * r + d * d - R * R) / (2 * r * d)))) * R2D;
    const { ra, dec } = eclToEq(Math.atan2(g[1], g[0]) + precession(date), Math.asin(g[2] / d));
    return { name, ra, dec, mag: H + 5 * Math.log10(r * d) + phase(alpha) };
  });
}
// The Moon (Astronomical Almanac low-precision series, about 0.3 degrees): ecliptic position of date
// and horizontal parallax, which shifts it by up to a degree as seen from Earth's surface.
function moonPos(date) {
  const T = (jd(date) - 2451545) / 36525, s = d => Math.sin(d * D2R), c = d => Math.cos(d * D2R);
  const lon = 218.32 + 481267.881 * T + 6.29 * s(135.0 + 477198.87 * T) - 1.27 * s(259.3 - 413335.36 * T)
    + 0.66 * s(235.7 + 890534.22 * T) + 0.21 * s(269.9 + 954397.74 * T) - 0.19 * s(357.5 + 35999.05 * T) - 0.11 * s(186.5 + 966404.03 * T);
  const lat = 5.13 * s(93.3 + 483202.02 * T) + 0.28 * s(228.2 + 960400.89 * T) - 0.28 * s(318.3 + 6003.15 * T) - 0.17 * s(217.6 - 407332.21 * T);
  const par = 0.9508 + 0.0518 * c(135.0 + 477198.87 * T) + 0.0095 * c(259.3 - 413335.36 * T) + 0.0078 * c(235.7 + 890534.22 * T) + 0.0028 * c(269.9 + 954397.74 * T);
  const { ra, dec } = eclToEq(lon * D2R, lat * D2R, (23.439 - 0.013 * T) * D2R);
  return { ra, dec, lon: lon * D2R, lat: lat * D2R, parallax: par };
}

// Stars to magnitude 4, constellation lines and names (sky-data.js), shifted once for the Earth's
// axis wobble since 2000 (it changes far too slowly to matter during one night).
const CATALOG = (() => {
  const d = window.SKY_DATA || { stars: [], lines: [], names: [] }, now = new Date();
  const pr = (ra, dec) => precess(ra * D2R, dec * D2R, now);
  return {
    stars: d.stars.map(([ra, dec, mag, name]) => ({ name, mag, ...pr(ra, dec) })),
    lines: d.lines.map(seg => seg.map(([ra, dec]) => pr(ra, dec))),
    names: d.names.map(([ra, dec, name, rank]) => ({ name, rank, ...pr(ra, dec) })),
  };
})();

const sky = { stars: [], lines: [], names: [], planets: [], moon: null, sunEl: -90, sunV: [0, 0, -1] };
function computeSky() {
  if (!S.loc) return;
  const date = new Date(simNow()), gmst = satellite.gstime(date), sun = sunPos(date);
  const lat = S.loc.lat * D2R, lon = S.loc.lon * D2R;
  const sa = raDecToAltAz(sun.ra, sun.dec, gmst, lat, lon);
  sky.sunEl = sa.el; sky.sunV = enu(sa.az, sa.el);
  const place = o => { const a = raDecToAltAz(o.ra, o.dec, gmst, lat, lon); return { ...a, v: enu(a.az, a.el) }; };
  sky.stars = CATALOG.stars.map(s => ({ name: s.name, kind: "star", mag: s.mag, ...place(s) }));
  sky.lines = CATALOG.lines.map(seg => seg.map(place));
  sky.names = CATALOG.names.map(n => ({ name: n.name, rank: n.rank, ...place(n) }));
  sky.planets = planetPositions(date).map(p => { const a = raDecToAltAz(p.ra, p.dec, gmst, lat, lon); return { name: p.name, kind: "planet", mag: p.mag, ...a, v: enu(a.az, a.el) }; });
  const m = moonPos(date), ma = raDecToAltAz(m.ra, m.dec, gmst, lat, lon);
  ma.el -= m.parallax * Math.cos(ma.el * D2R);
  // lit fraction from the Moon's angle to the Sun
  const lit = (1 - Math.cos(m.lat) * Math.cos(m.lon - sun.lam)) / 2;
  sky.moon = { name: "Moon", kind: "moon", mag: -12, lit, ...ma, v: enu(ma.az, ma.el) };
}

// ---------- one satellite at a time (main thread) ----------
function rec(sat) {
  if (sat.rec === undefined) {
    try { sat.rec = satellite.twoline2satrec(sat.l1, sat.l2); if (sat.rec.error) sat.rec = null; } catch { sat.rec = null; }
  }
  return sat.rec;
}

function lookOne(sat, date) {
  const r = rec(sat);
  if (!r) return null;
  const pv = satellite.propagate(r, date);
  if (!pv || !pv.position) return null;
  const gmst = satellite.gstime(date), geo = satellite.eciToGeodetic(pv.position, gmst), v = pv.velocity;
  const out = { lat: geo.latitude * R2D, lon: geo.longitude * R2D, alt: geo.height, speed: Math.hypot(v.x, v.y, v.z), lit: !inShadow(pv.position, sunPos(date).v) };
  if (S.loc) {
    const la = satellite.ecfToLookAngles(observerGd(), satellite.eciToEcf(pv.position, gmst));
    Object.assign(out, { az: ((la.azimuth * R2D) + 360) % 360, el: la.elevation * R2D, range: la.rangeSat });
    if (out.lit && out.el > -1) out.mag = magnitude(sat.m0, pv.position, sunPos(date).v, observerEci(gmst), out.range, out.el);
  }
  return out;
}

const paths = new Map();
function computePaths() {
  paths.clear();
  if (!S.loc) return;
  const date = new Date(simNow()), gd = observerGd();
  // the followed pass draws its own full path, so the selected satellite only gets a trail otherwise
  const want = S.now.filter(e => e.el > 0 && e.sat !== WATCH.sat && (e.sat.id === S.targetId || (e.lit && e.sat.cat === "bright" && S.show.bright))).slice(0, 30);
  for (const e of want) {
    const r = rec(e.sat); if (!r) continue;
    const pts = [];
    for (let s = -180; s <= 300; s += 20) {
      const t = new Date(+date + s * 1000), pv = satellite.propagate(r, t);
      if (!pv || !pv.position) continue;
      const la = satellite.ecfToLookAngles(gd, satellite.eciToEcf(pv.position, satellite.gstime(t)));
      pts.push({ v: enu(la.azimuth * R2D, la.elevation * R2D), future: s > 0 });
    }
    paths.set(e.sat.idx, pts);
  }
}

// Passes of one satellite over the next 48 hours (cached for 10 minutes).
function passesFor(sat) {
  const key = S.loc ? `${S.loc.lat},${S.loc.lon}` : "";
  if (sat._passes && sat._passes.key === key && Date.now() - sat._passes.at < 10 * 60e3) return sat._passes.list;
  const r = rec(sat), list = [];
  if (r && S.loc) {
    const gd = observerGd(), lat = S.loc.lat * D2R, lon = S.loc.lon * D2R, start = Date.now(), step = 30e3;
    let cur = null;
    for (let s = 0; s <= 48 * 120; s++) {
      const date = new Date(start + s * step), gmst = satellite.gstime(date);
      const pv = satellite.propagate(r, date);
      if (!pv || !pv.position) break;
      const la = satellite.ecfToLookAngles(gd, satellite.eciToEcf(pv.position, gmst));
      const el = la.elevation * R2D, az = ((la.azimuth * R2D) + 360) % 360;
      if (el > 0) {
        if (!cur) cur = { start: +date, startAz: az, maxEl: -90, visible: false, mag: 99 };
        if (el > cur.maxEl) { cur.maxEl = el; cur.maxTime = +date; cur.maxAz = az; }
        if (el > 10) {
          const sun = sunPos(date), se = raDecToAltAz(sun.ra, sun.dec, gmst, lat, lon).el;
          if (se < -6 && !inShadow(pv.position, sun.v)) {
            const mag = magnitude(sat.m0, pv.position, sun.v, observerEci(gmst), la.rangeSat, el);
            const mo = moonPos(date), ma = raDecToAltAz(mo.ra, mo.dec, gmst, lat, lon);
            const limit = skyLimitAt(se, ma.el, (1 - Math.cos(mo.lat) * Math.cos(mo.lon - sun.lam)) / 2);
            if (mag < cur.mag) { cur.mag = mag; cur.limit = limit; }
            if (mag < limit) cur.visible = true;
          }
        }
        cur.end = +date; cur.endAz = az;
      } else if (cur) { if (cur.maxEl >= 10) list.push(cur); cur = null; if (list.length >= 8) break; }
    }
    if (cur && cur.maxEl >= 10) list.push(cur);
  }
  sat._passes = { key, at: Date.now(), list };
  return list;
}
function nextPass(sat) { return passesFor(sat).find(p => p.end > Date.now()); }

const MU = 398600.4418, RE = 6378.137;
function orbitInfo(sat) {
  const r = rec(sat);
  if (!r) return null;
  const n = r.no / 60, a = Math.cbrt(MU / (n * n)), e = r.ecco;
  const period = 2 * Math.PI / r.no, apo = a * (1 + e) - RE, peri = a * (1 - e) - RE, inc = r.inclo * R2D;
  let cls, short, note;
  if (period > 1300 && period < 1600 && e < 0.1) {
    short = "GEO";
    cls = inc < 3 ? "Geostationary orbit (GEO)" : "Geosynchronous orbit (GEO)";
    note = inc < 3 ? "Hangs almost still in the sky" : "Drifts in a slow figure-8 each day";
  } else if (apo < 2000) { short = "LEO"; cls = "Low Earth orbit (LEO)"; note = "Crosses the sky in a few minutes"; }
  else if (e > 0.25) { short = "HEO"; cls = "Highly elliptical orbit (HEO)"; note = "Swings far out, then dips close to Earth"; }
  else { short = "MEO"; cls = "Medium Earth orbit (MEO)"; note = "Moves slowly, over hours"; }
  return { period, apo, peri, inc, e, cls, short, note, perDay: 1440 / period };
}
function tleEpoch(l1) {
  const yy = +l1.slice(18, 20), doy = parseFloat(l1.slice(20, 32));
  return new Date(Date.UTC(yy < 57 ? 2000 + yy : 1900 + yy, 0, 1) + (doy - 1) * 86400e3);
}
function intlDesig(l1) {
  const s = l1.slice(9, 17).trim();
  if (!/^\d{5}/.test(s)) return null;
  const yy = +s.slice(0, 2), year = yy < 57 ? 2000 + yy : 1900 + yy;
  return { year, code: `${year}-${s.slice(2)}` };
}
function operatorOf(sat) {
  for (const [re, op, role] of CODES.OPERATORS) if (re.test(sat.nameU)) return { op, role };
  if (/ R\/B/.test(sat.nameU)) return { op: null, role: "Rocket stage" };
  if (/ DEB/.test(sat.nameU)) return { op: null, role: "Debris" };
  return null;
}

// Owner, launch date and site from the CelesTrak satellite catalog, fetched when a satellite is selected.
const catMem = new Map();
async function catalog(sat) {
  if (catMem.has(sat.id)) return catMem.get(sat.id);
  const saved = store.get("cat_" + sat.id, null);
  if (saved) { catMem.set(sat.id, saved); return saved; }
  const r = await fetchT(`https://celestrak.org/satcat/records.php?CATNR=${fromAlpha5(sat.id)}&FORMAT=JSON`, 10000);
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json(), c = Array.isArray(j) ? j[0] : null;
  if (!c) throw new Error("not in catalog");
  const keep = { owner: c.OWNER, launch: c.LAUNCH_DATE, site: c.LAUNCH_SITE, type: c.OBJECT_TYPE, status: c.OPS_STATUS_CODE, objId: c.OBJECT_ID };
  catMem.set(sat.id, keep); store.set("cat_" + sat.id, keep);
  return keep;
}
const STATUS = { "+": "Operational", "-": "Not operational", "P": "Partially operational", "B": "Backup / standby", "S": "Spare", "X": "Extended mission", "D": "Decayed", "?": "Unknown" };
const ownerName = c => c && c.owner ? (CODES.OWNERS[c.owner] || c.owner) : null;
