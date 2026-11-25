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
const SKY_LIMITS = [[3.5, tl("City", "Stadt", "Місто")], [4.5, tl("Suburb", "Vorort", "Передмістя")], [5.5, tl("Village", "Dorf", "Село")], [6.5, tl("Dark countryside", "Dunkles Land", "Темна місцевість")]];
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
  if (c.sunEl > -15) why.push(tl("twilight", "Dämmerung", "сутінки"));
  if (c.moonEl > 0 && c.moonLit > 0.25 && S.limit > 3.5) why.push(tl(`Moon ${Math.round(c.moonLit * 100)}% lit`, `Mond zu ${Math.round(c.moonLit * 100)} % beleuchtet`, `Місяць освітлений на ${Math.round(c.moonLit * 100)} %`));
  return `${tl("down to magnitude", "bis Magnitude", "до зоряної величини")} ${fmtN(c.limit, 1)}${why.length ? ` (${why.join(", ")})` : ""}`;
}
function brightWord(mag, L = limitNow()) {
  return mag < L - 5 ? tl("very bright", "sehr hell", "дуже яскравий") : mag < L - 3 ? tl("bright", "hell", "яскравий") : mag < L - 1.5 ? tl("easy to see", "gut zu sehen", "добре видно")
    : mag < L ? tl("faint, but visible from your sky", "schwach, aber an deinem Himmel sichtbar", "слабкий, але видно з твого неба") : tl("too faint to see from your sky", "zu schwach für deinen Himmel", "заслабкий для твого неба");
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
// The Moon: the main terms of Meeus' lunar series (Astronomical Algorithms, chapter 47), good to
// well under an arcminute, which eclipses need (the Moon's disc is only half a degree). Rows are
// [D, M, M', F, coefficient]: sines in millionths of a degree for longitude and latitude, cosines in
// metres for distance. The parallax shifts the Moon by up to a degree as seen from Earth's surface.
const MOON_LON = [[0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],[0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],
  [2,-1,-1,0,57066],[2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],[0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,2,-12528],
  [0,0,1,-2,10980],[4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],[2,1,0,0,-6766],[1,0,-1,0,-5163],[1,1,0,0,4987],
  [2,-1,1,0,4036],[2,0,2,0,3994],[4,0,0,0,3861],[2,0,-3,0,3665],[0,1,-2,0,-2689],[2,0,-1,2,-2602],[2,-1,-2,0,2390],[1,0,1,0,-2348],
  [2,-2,0,0,2236],[0,1,2,0,-2120],[0,2,0,0,-2069],[2,-2,-1,0,2048],[2,0,1,-2,-1773],[2,0,0,2,-1595],[4,-1,-1,0,1215],[0,0,2,2,-1110]];
const MOON_LAT = [[0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],[2,0,-1,1,55413],[2,0,-1,-1,46271],[2,0,0,1,32573],
  [0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],[2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],
  [2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],[0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],
  [0,1,1,1,-1475],[0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],[4,0,0,-1,1021],[4,0,-1,1,833]];
const MOON_DIST = [[0,0,1,0,-20905355],[2,0,-1,0,-3699111],[2,0,0,0,-2955968],[0,0,2,0,-569925],[0,1,0,0,48888],[0,0,0,2,-3149],[2,0,-2,0,246158],
  [2,-1,-1,0,-152138],[2,0,1,0,-170733],[2,-1,0,0,-204586],[0,1,-1,0,-129620],[1,0,0,0,108743],[0,1,1,0,104755],[2,0,0,-2,10321],
  [0,0,1,-2,79661],[4,0,-1,0,-34782],[0,0,3,0,-23210],[4,0,-2,0,-21636],[2,1,-1,0,24208],[2,1,0,0,30824],[1,0,-1,0,-8379],[1,1,0,0,-16675],
  [2,-1,1,0,-12831],[2,0,2,0,-10445],[4,0,0,0,-11650],[2,0,-3,0,14403],[0,1,-2,0,-7003],[2,-1,-2,0,10056],[1,0,1,0,6322],[2,-2,0,0,-9884]];
function moonPos(date) {
  const T = (jd(date) + 69 / 86400 - 2451545) / 36525;   // in Terrestrial Time, about 69 s ahead of the clock
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T, D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T, Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T;
  const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T, E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const sum = (rows, fn) => rows.reduce((s, [d, m, mp, f, k]) => s + k * (m ? (Math.abs(m) === 1 ? E : E * E) : 1) * fn((d * D + m * M + mp * Mp + f * F) * D2R), 0);
  const A1 = (119.75 + 131.849 * T) * D2R, A2 = (53.09 + 479264.290 * T) * D2R, A3 = (313.45 + 481266.484 * T) * D2R, L = Lp * D2R, Fr = F * D2R, Mr = Mp * D2R;
  const sl = sum(MOON_LON, Math.sin) + 3958 * Math.sin(A1) + 1962 * Math.sin(L - Fr) + 318 * Math.sin(A2);
  const sb = sum(MOON_LAT, Math.sin) - 2235 * Math.sin(L) + 382 * Math.sin(A3) + 175 * Math.sin(A1 - Fr) + 175 * Math.sin(A1 + Fr) + 127 * Math.sin(L - Mr) - 115 * Math.sin(L + Mr);
  const dist = 385000.56 + sum(MOON_DIST, Math.cos) / 1000;
  const lon = (Lp + sl / 1e6) * D2R, lat = sb / 1e6 * D2R;
  // nutation (main term) for the apparent position, and the obliquity of the ecliptic of date
  const om = (125.04452 - 1934.136261 * T) * D2R;
  const { ra, dec } = eclToEq(lon - 17.2 / 3600 * Math.sin(om) * D2R, lat, (23.439291 - 0.0130042 * T + 9.2 / 3600 * Math.cos(om)) * D2R);
  return { ra, dec, lon, lat, dist, parallax: Math.asin(6378.14 / dist) * R2D };
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
  if (typeof computeSkyGuide === "function") computeSkyGuide(date, gmst, lat, lon);   // showers, comets, aurora (skyguide.js)
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
  // Only the selected satellite gets a trail (where it was, where it's going); a followed pass
  // draws its own full path instead.
  const want = S.now.filter(e => e.el > 0 && e.sat !== WATCH.sat && e.sat.id === S.targetId);
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

// Your own horizon (trees and rooftops, recorded in horizon.js): 72 heights in degrees, one for every
// 5° of compass direction, or null for a flat horizon. skylineVer changes whenever it does.
let skyline = null, skylineVer = 0;
function skylineAt(az) {
  if (!skyline) return 0;
  const x = (((az % 360) + 360) % 360) / 5, i = Math.floor(x) % 72, f = x - Math.floor(x);
  return skyline[i] * (1 - f) + skyline[(i + 1) % 72] * f;
}
const behindSkyline = (az, el) => !!skyline && el < skylineAt(az);

// Passes of one satellite over the next 48 hours (cached for 10 minutes). With `from` (ms) they are
// worked out from that moment instead, without the cache; the automatic checks use it.
// A pass that never rises above your skyline is marked `blocked`, and only counts as visible while
// it is above it.
function passesFor(sat, from) {
  const key = S.loc ? `${S.loc.lat},${S.loc.lon},${skylineVer}` : "";
  if (from == null && sat._passes && sat._passes.key === key && Date.now() - sat._passes.at < 10 * 60e3) return sat._passes.list;
  const r = rec(sat), list = [];
  if (r && S.loc) {
    const gd = observerGd(), lat = S.loc.lat * D2R, lon = S.loc.lon * D2R, start = from ?? Date.now(), step = 30e3;
    const done = p => { refinePeak(p, t => lookAngles(r, gd, t), step); p.blocked = !!skyline && !p.clear; list.push(p); };
    let cur = null, prevEl = null;
    for (let s = 0; s <= 48 * 120; s++) {
      const date = new Date(start + s * step), gmst = satellite.gstime(date);
      const pv = satellite.propagate(r, date);
      if (!pv || !pv.position) break;
      const la = satellite.ecfToLookAngles(gd, satellite.eciToEcf(pv.position, gmst));
      const el = la.elevation * R2D, az = ((la.azimuth * R2D) + 360) % 360, top = skylineAt(az), was = prevEl;
      prevEl = el;
      if (el > 0) {
        // the moment it crossed the horizon, between this look and the one before
        if (!cur) cur = { start: was != null && was <= 0 ? +date - step * el / (el - was) : +date, startAz: az, maxEl: -90, visible: false, mag: 99, clear: false };
        if (el > cur.maxEl) { cur.maxEl = el; cur.maxTime = +date; cur.maxAz = az; }
        if (el > top + 1) cur.clear = true;
        if (el > Math.max(10, top)) {
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
      } else if (cur) {
        cur.end += step * was / (was - el);   // where it went below the horizon, between the last two looks
        if (cur.maxEl >= 10) done(cur);
        cur = null; if (list.length >= 8) break;
      }
    }
    if (cur && cur.maxEl >= 10) done(cur);
  }
  if (from == null) sat._passes = { key, at: Date.now(), list };
  return list;
}
// Direction (az, el in degrees) of a satellite at time t (ms).
function lookAngles(r, gd, t) {
  const d = new Date(t), pv = satellite.propagate(r, d);
  if (!pv || !pv.position) return { az: 0, el: -90 };
  const la = satellite.ecfToLookAngles(gd, satellite.eciToEcf(pv.position, satellite.gstime(d)));
  return { az: ((la.azimuth * R2D) + 360) % 360, el: la.elevation * R2D };
}
// Looking only every `step` ms can miss the very top of a fast, high pass by a few degrees, so the
// highest point is narrowed down to within half a second around the best look.
function refinePeak(p, at, step) {
  let a = p.maxTime - step, b = p.maxTime + step;
  for (let k = 0; k < 14; k++) { const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3; if (at(m1).el < at(m2).el) a = m1; else b = m2; }
  const t = (a + b) / 2, l = at(t);
  if (l.el > p.maxEl) { p.maxEl = l.el; p.maxTime = t; p.maxAz = l.az; }
}
function nextPass(sat) { return passesFor(sat).find(p => p.end > Date.now()); }

// How high and how bright a satellite is through one pass, in n steps: for the small graph in the
// details panel. Brightness only counts while it is sunlit and the sky is dark enough.
function passProfile(sat, p, n = 36) {
  const r = rec(sat), out = [];
  if (!r || !S.loc) return out;
  const gd = observerGd(), lat = S.loc.lat * D2R, lon = S.loc.lon * D2R;
  for (let k = 0; k <= n; k++) {
    const date = new Date(p.start + (p.end - p.start) * k / n), gmst = satellite.gstime(date), pv = satellite.propagate(r, date);
    if (!pv || !pv.position) continue;
    const la = satellite.ecfToLookAngles(gd, satellite.eciToEcf(pv.position, gmst)), el = la.elevation * R2D;
    const sun = sunPos(date), dark = raDecToAltAz(sun.ra, sun.dec, gmst, lat, lon).el < -6, lit = !inShadow(pv.position, sun.v);
    const az = ((la.azimuth * R2D) + 360) % 360;
    out.push({ el: Math.max(0, el), lit, dark, hidden: behindSkyline(az, el),
               mag: lit && el > 0 ? magnitude(sat.m0, pv.position, sun.v, observerEci(gmst), la.rangeSat, el) : null });
  }
  return out;
}

const MU = 398600.4418, RE = 6378.137;
function orbitInfo(sat) {
  const r = rec(sat);
  if (!r) return null;
  const n = r.no / 60, a = Math.cbrt(MU / (n * n)), e = r.ecco;
  const period = 2 * Math.PI / r.no, apo = a * (1 + e) - RE, peri = a * (1 - e) - RE, inc = r.inclo * R2D;
  let cls, short, note;
  if (period > 1300 && period < 1600 && e < 0.1) {
    short = "GEO";
    cls = inc < 3 ? tl("Geostationary orbit (GEO)", "Geostationäre Bahn (GEO)", "Геостаціонарна орбіта (GEO)") : tl("Geosynchronous orbit (GEO)", "Geosynchrone Bahn (GEO)", "Геосинхронна орбіта (GEO)");
    note = inc < 3 ? tl("Hangs almost still in the sky", "Steht fast still am Himmel", "Майже нерухомо висить у небі") : tl("Drifts in a slow figure-8 each day", "Zieht jeden Tag langsam eine Acht", "Щодня повільно описує вісімку");
  } else if (apo < 2000) { short = "LEO"; cls = tl("Low Earth orbit (LEO)", "Niedrige Erdumlaufbahn (LEO)", "Низька навколоземна орбіта (LEO)"); note = tl("Crosses the sky in a few minutes", "Überquert den Himmel in wenigen Minuten", "Перетинає небо за кілька хвилин"); }
  else if (e > 0.25) { short = "HEO"; cls = tl("Highly elliptical orbit (HEO)", "Stark elliptische Bahn (HEO)", "Високоеліптична орбіта (HEO)"); note = tl("Swings far out, then dips close to Earth", "Schwingt weit hinaus und kommt dann nah an die Erde heran", "Далеко віддаляється, а потім підходить близько до Землі"); }
  else { short = "MEO"; cls = tl("Medium Earth orbit (MEO)", "Mittlere Erdumlaufbahn (MEO)", "Середня навколоземна орбіта (MEO)"); note = tl("Moves slowly, over hours", "Bewegt sich langsam, über Stunden", "Рухається повільно, годинами"); }
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
  if (/ R\/B/.test(sat.nameU)) return { op: null, role: tl("Rocket stage", "Raketenstufe", "Ступінь ракети") };
  if (/ DEB/.test(sat.nameU)) return { op: null, role: tl("Debris", "Trümmerteil", "Уламок") };
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
const STATUS = tl(
  { "+": "Operational", "-": "Not operational", "P": "Partially operational", "B": "Backup / standby", "S": "Spare", "X": "Extended mission", "D": "Decayed", "?": "Unknown" },
  { "+": "In Betrieb", "-": "Außer Betrieb", "P": "Teilweise in Betrieb", "B": "Reserve / Bereitschaft", "S": "Ersatz", "X": "Verlängerte Mission", "D": "Verglüht", "?": "Unbekannt" },
  { "+": "Працює", "-": "Не працює", "P": "Частково працює", "B": "Резерв / очікування", "S": "Запасний", "X": "Подовжена місія", "D": "Згорів в атмосфері", "?": "Невідомо" });
const ownerName = c => c && c.owner ? (CODES.OWNERS[c.owner] || c.owner) : null;
