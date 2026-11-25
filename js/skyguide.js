// Overhead: The night-sky guide: what else is worth looking up at tonight, and what's coming soon.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// Planets, close pairings with the Moon and bright stars, meteor showers, New and Full Moon,
// eclipses (from NASA's tables), aurora chances (NOAA's live forecast) and bright comets (orbits
// from NASA JPL, refreshed daily by the site). Shown in the Tonight tab; showers, comets and a
// possible aurora are also marked on the sky.

const DAY = 86400e3;
const altAzAt = (ra, dec, t) => raDecToAltAz(ra, dec, satellite.gstime(new Date(t)), S.loc.lat * D2R, S.loc.lon * D2R);
const sunAltAt = t => { const s = sunPos(new Date(t)); return altAzAt(s.ra, s.dec, t).el; };
// The Moon as seen from where you are: its parallax lowers it by up to a degree.
function moonAltAzAt(t) { const m = moonPos(new Date(t)), a = altAzAt(m.ra, m.dec, t); a.el -= m.parallax * Math.cos(a.el * D2R); return { ...a, parallax: m.parallax }; }
const angleBetween = (a, b) => { const u = enu(a.az, a.el), v = enu(b.az, b.el); return Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]))) * R2D; };
// The first stretch, from t0 on, with the Sun more than -th degrees below the horizon.
function sunBelow(t0, th) {
  const step = 10 * 60e3;
  let start = sunAltAt(t0) < th ? t0 : null;
  for (let t = t0 + step; t < t0 + 36 * 3600e3; t += step) {
    const below = sunAltAt(t) < th;
    if (below && start == null) start = t;
    if (!below && start != null) return { start, end: t };
  }
  return start == null ? null : { start, end: start + DAY };
}
const dayDate = t => { const d = new Date(t), other = d.getFullYear() !== new Date().getFullYear();   // the year only when it isn't this one
  return d.toLocaleDateString(tl("en-GB", "de-DE"), { weekday: "short", day: "numeric", month: "short", ...(other ? { year: "numeric" } : {}) }); };
const whereWord = (az, el) => el < 20 ? tl(`low in the ${compassName(az)}`, `tief im ${compassName(az)}`)
  : el > 55 ? tl(`high in the ${compassName(az)}`, `hoch im ${compassName(az)}`) : tl(`in the ${compassName(az)}`, `im ${compassName(az)}`);
const noonOf = t => { const d = new Date(t); d.setHours(12, 0, 0, 0); return +d; };

// ---------- planets tonight ----------
// Each planet's times above 5° between dusk and dawn (Sun 3° down: planets show in twilight),
// and where it is highest.
function planetsTonight(t0) {
  const win = sunBelow(t0, -3); if (!win) return [];
  const step = 10 * 60e3, tracks = PLANETS.map(() => ({ spans: [], best: null }));
  for (let t = win.start; t <= win.end; t += step) {
    planetPositions(new Date(t)).forEach((p, i) => {
      const a = altAzAt(p.ra, p.dec, t), k = tracks[i], open = k.spans[k.spans.length - 1];
      if (a.el > 5) {
        if (open && open.end === t - step) open.end = t; else k.spans.push({ start: t, end: t });
        if (!k.best || a.el > k.best.el) k.best = { el: a.el, az: a.az, t, mag: p.mag };
      }
    });
  }
  return PLANETS.map(([name], i) => ({ name, ...tracks[i], win, step })).filter(p => p.best);
}
function planetWhen(p) {
  const s = p.spans, near = (a, b) => Math.abs(a - b) <= p.step;
  if (s.length === 1 && near(s[0].start, p.win.start) && near(s[0].end, p.win.end)) return tl("all night", "die ganze Nacht");
  return s.map(x => near(x.start, p.win.start) ? tl(`until ${fmtTime(x.end)}`, `bis ${fmtTime(x.end)}`)
    : near(x.end, p.win.end) ? tl(`from ${fmtTime(x.start)}`, `ab ${fmtTime(x.start)}`) : `${fmtTime(x.start)}–${fmtTime(x.end)}`).join(tl(" and ", " und "));
}

// ---------- close pairings: the Moon or a planet near another planet or a bright star ----------
const PAIR_STARS = ["Aldebaran", "Regulus", "Spica", "Antares", "Pollux"];   // bright stars along the Moon's and planets' path
const PLEIADES = { name: "Pleiades", ...precess(56.75 * D2R, 24.12 * D2R, new Date()) };
const pairLimit = (a, b) => a.kind === "moon" || b.kind === "moon" ? (a.kind === "star" || b.kind === "star" ? 3 : 5) : (a.kind === "star" || b.kind === "star" ? 2 : 3);
const objName = o => o.key === "Pleiades" ? tl("the Pleiades", "die Plejaden") : o.kind === "moon" ? tl("the Moon", "der Mond") : skyName(o.key);
function pairsAhead(t0, nights) {
  const stars = [...CATALOG.stars.filter(s => PAIR_STARS.includes(s.name)), PLEIADES], best = new Map();
  for (let n = 0; n < nights; n++) {
    const win = sunBelow(noonOf(t0) + n * DAY, -6); if (!win) continue;
    for (let t = win.start + 30 * 60e3; t < win.end; t += 3600e3) {
      const objs = [{ key: "Moon", kind: "moon", ...moonAltAzAt(t) }];
      for (const p of planetPositions(new Date(t))) objs.push({ key: p.name, kind: "planet", ...altAzAt(p.ra, p.dec, t) });
      for (const s of stars) objs.push({ key: s.name, kind: "star", ...altAzAt(s.ra, s.dec, t) });
      for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) {
        const a = objs[i], b = objs[j];
        if ((a.kind === "star" && b.kind === "star") || a.el < 10 || b.el < 10) continue;
        const sep = angleBetween(a, b), key = `${a.key}|${b.key}`, old = best.get(key);
        if (sep <= pairLimit(a, b) && (!old || sep < old.sep)) best.set(key, { t, sep, a, b });
      }
    }
  }
  return [...best.values()].sort((x, y) => x.t - y.t);
}
const pairText = p => tl(`${cap(objName(p.a))} and ${objName(p.b)} ${fmtN(p.sep, 1)}° apart, ${whereWord(p.a.az, p.a.el)}`,
                          `${cap(objName(p.a))} und ${objName(p.b)} ${fmtN(p.sep, 1)}° auseinander, ${whereWord(p.a.az, p.a.el)}`);

// ---------- meteor showers (IMO calendar; peaks shift by about a day from year to year) ----------
// [name, German name, active from, peak, active until (month-day), ZHR at the peak, radiant RA and
//  Dec (degrees, J2000), how fast the rate falls away from the peak (days)]
const SHOWERS = [
  ["Quadrantids", "Quadrantiden", "12-28", "01-03", "01-12", 110, 230, 49, 0.7],
  ["Lyrids", "Lyriden", "04-14", "04-22", "04-30", 18, 271, 34, 1.3],
  ["Eta Aquariids", "Eta-Aquariiden", "04-19", "05-06", "05-28", 50, 338, -1, 5],
  ["Southern Delta Aquariids", "Südliche Delta-Aquariiden", "07-12", "07-31", "08-23", 25, 340, -16, 7],
  ["Perseids", "Perseiden", "07-17", "08-12", "08-24", 100, 48, 58, 2.5],
  ["Draconids", "Draconiden", "10-06", "10-08", "10-10", 10, 262, 54, 1],
  ["Orionids", "Orioniden", "10-02", "10-21", "11-07", 20, 95, 16, 4],
  ["Leonids", "Leoniden", "11-06", "11-17", "11-30", 15, 152, 22, 2],
  ["Geminids", "Geminiden", "12-04", "12-14", "12-20", 150, 112, 33, 1.3],
  ["Ursids", "Ursiden", "12-17", "12-22", "12-26", 10, 217, 76, 1],
];
const mdTime = (year, md) => { const [m, d] = md.split("-").map(Number); return Date.UTC(year, m - 1, d, 12); };
// Where t falls in a shower's season: days from its nearest peak, and whether it is active then.
function showerAt(s, t) {
  const y = new Date(t).getUTCFullYear();
  let best = null;
  for (const yy of [y - 1, y, y + 1]) {
    const peak = mdTime(yy, s[3]);
    let from = mdTime(yy, s[2]), until = mdTime(yy, s[4]);
    if (from > peak) from = mdTime(yy - 1, s[2]);   // seasons that start in the year before the peak
    if (until < peak) until = mdTime(yy + 1, s[4]);
    const d = (t - peak) / DAY;
    if (!best || Math.abs(d) < Math.abs(best.days)) best = { days: d, peak, active: t >= from && t <= until + DAY };
  }
  return { ...best, name: tl(s[0], s[1]), zhr: best.active ? Math.max(2, s[5] * Math.exp(-Math.abs(best.days) / s[8])) : 0,
           radiant: precess(s[6] * D2R, s[7] * D2R, new Date(t)) };
}
// Tonight's showers worth mentioning: how many meteors an hour you might see at best, when the
// radiant is highest in the dark (rate = ZHR × sin(radiant height) × 2.3^(sky limit − 6.5)).
function showersTonight(t0) {
  const win = sunBelow(t0, -12); if (!win) return [];
  const out = [];
  for (const s of SHOWERS) {
    const sh = showerAt(s, (win.start + win.end) / 2);
    if (!sh.active || sh.zhr < 5) continue;
    let best = null;
    for (let t = win.start; t <= win.end; t += 20 * 60e3) {
      const a = altAzAt(sh.radiant.ra, sh.radiant.dec, t);
      if (a.el <= 5) continue;
      const rate = sh.zhr * Math.sin(a.el * D2R) * Math.pow(2.3, conditionsAt(t).limit - 6.5);
      if (!best || rate > best.rate) best = { rate, t, az: a.az, el: a.el };
    }
    out.push({ ...sh, best });
  }
  return out;
}
function showerText(sh) {
  const peak = Math.abs(sh.days) < 0.75 ? tl("peak tonight", "Höhepunkt heute Nacht")
    : sh.days < 0 ? tl(`peak ${fmtDate(new Date(sh.peak))}`, `Höhepunkt am ${fmtDate(new Date(sh.peak))}`) : tl("past its peak", "nach dem Höhepunkt");
  if (!sh.best) return tl(`${sh.name} (${peak}): their radiant stays too low here tonight`, `${sh.name} (${peak}): ihr Ausstrahlungspunkt bleibt hier heute zu tief`);
  const n = sh.best.rate;
  const rate = n >= 10 ? tl(`up to about ${fmtN(Math.round(n / 5) * 5)} an hour`, `bis zu etwa ${fmtN(Math.round(n / 5) * 5)} pro Stunde`) : n >= 2 ? tl(`a few an hour`, `einige pro Stunde`) : tl("only the odd one", "nur vereinzelt");
  return tl(`${sh.name} (${peak}): ${rate}, best around ${fmtTime(sh.best.t)}`, `${sh.name} (${peak}): ${rate}, am besten gegen ${fmtTime(sh.best.t)}`);
}

// ---------- New and Full Moon ----------
function moonPhasesAhead(t0, days) {
  const elong = t => { const d = new Date(t); return ((moonPos(d).lon - sunPos(d).lam) * R2D % 360 + 360) % 360; }, out = [];
  let prev = elong(t0);
  for (let t = t0 + 3600e3; t < t0 + days * DAY; t += 3600e3) {
    const e = elong(t);
    if (prev > 300 && e < 60) out.push({ t: t - 3600e3 + (360 - prev) / (360 - prev + e) * 3600e3, full: false });
    else if (prev < 180 && e >= 180) out.push({ t: t - 3600e3 + (180 - prev) / (e - prev) * 3600e3, full: true });
    prev = e;
  }
  return out;
}

// ---------- eclipses: NASA's table (eclipse.gsfc.nasa.gov), times of greatest eclipse in TD ----------
// [S = solar or L = lunar, type: T total, A annular, H hybrid, P partial, N penumbral, date and TD time]
const ECLIPSES = [
  ["L", "N", "2027-02-20 23:14:06"], ["S", "A", "2027-02-06 16:00:47"], ["L", "N", "2027-07-18 16:04:09"], ["S", "T", "2027-08-02 10:07:49"],
  ["L", "N", "2027-08-17 07:14:59"], ["L", "P", "2028-01-12 04:14:13"], ["S", "A", "2028-01-26 15:08:58"], ["L", "P", "2028-07-06 18:20:57"],
  ["S", "T", "2028-07-22 02:56:39"], ["L", "T", "2028-12-31 16:53:15"], ["S", "P", "2029-01-14 17:13:47"], ["S", "P", "2029-06-12 04:06:13"],
  ["L", "T", "2029-06-26 03:23:22"], ["S", "P", "2029-07-11 15:37:18"], ["S", "P", "2029-12-05 15:03:57"], ["L", "T", "2029-12-20 22:43:12"],
  ["S", "A", "2030-06-01 06:29:13"], ["L", "P", "2030-06-15 18:34:34"], ["S", "T", "2030-11-25 06:51:37"], ["L", "N", "2030-12-09 22:28:51"],
  ["L", "N", "2031-05-07 03:52:02"], ["S", "A", "2031-05-21 07:16:04"], ["L", "N", "2031-06-05 11:45:17"], ["L", "N", "2031-10-30 07:46:45"],
  ["S", "H", "2031-11-14 21:07:30"], ["L", "T", "2032-04-25 15:14:51"], ["S", "A", "2032-05-09 13:26:42"], ["L", "T", "2032-10-18 19:03:40"],
  ["S", "P", "2032-11-03 05:34:12"], ["S", "T", "2033-03-30 18:02:35"], ["L", "T", "2033-04-14 19:13:51"], ["S", "P", "2033-09-23 13:54:31"],
  ["L", "T", "2033-10-08 10:56:23"], ["S", "T", "2034-03-20 10:18:45"], ["L", "N", "2034-04-03 19:06:59"], ["S", "A", "2034-09-12 16:19:27"],
  ["L", "P", "2034-09-28 02:47:37"], ["L", "N", "2035-02-22 09:06:12"], ["S", "A", "2035-03-09 23:05:53"], ["L", "P", "2035-08-19 01:12:15"],
  ["S", "T", "2035-09-02 01:56:46"],
].map(([kind, type, td]) => ({ kind, type, t: Date.parse(td.replace(" ", "T") + "Z") - 70e3 }));   // TD is about 70 s ahead of UT

// How much of the Sun's disc a Moon disc covers (radii and distance between centres in degrees).
function coverage(rs, rm, d) {
  if (d >= rs + rm) return 0;
  if (d <= Math.abs(rm - rs)) return rm >= rs ? 1 : (rm * rm) / (rs * rs);
  const a = Math.acos((d * d + rs * rs - rm * rm) / (2 * d * rs)), b = Math.acos((d * d + rm * rm - rs * rs) / (2 * d * rm));
  return (rs * rs * a + rm * rm * b - 0.5 * Math.sqrt((-d + rs + rm) * (d + rs - rm) * (d - rs + rm) * (d + rs + rm))) / (Math.PI * rs * rs);
}
// What an eclipse looks like from here: lunar ones need the Moon up; for solar ones the Moon's
// disc is followed across the Sun's for 3 hours either side, every 3 minutes (for 12 August 2026 this
// gives 88% over south-west Germany, as seen).
function eclipseHere(ec) {
  if (ec.kind === "L") {
    for (const dt of [0, -30, 30, -60, 60, -90, 90]) { const t = ec.t + dt * 60e3, m = moonAltAzAt(t); if (m.el > 0) return { t, el: m.el, az: m.az }; }
    return null;
  }
  let best = null;
  for (let t = ec.t - 3 * 3600e3; t <= ec.t + 3 * 3600e3; t += 3 * 60e3) {
    const s = sunPos(new Date(t)), sa = altAzAt(s.ra, s.dec, t);
    if (sa.el < 0) continue;
    const m = moonAltAzAt(t), cov = coverage(0.2666, 0.2725 * m.parallax, angleBetween(sa, m));
    if (cov > 0.01 && (!best || cov > best.cov)) best = { t, cov, el: sa.el, az: sa.az };
  }
  return best;
}
function eclipseText(ec, here) {
  if (ec.kind === "L") return ({
    T: tl("Total lunar eclipse: the Moon turns coppery red", "Totale Mondfinsternis: Der Mond färbt sich kupferrot"),
    P: tl("Partial lunar eclipse: part of the Moon darkens", "Partielle Mondfinsternis: Ein Teil des Mondes verdunkelt sich"),
    N: tl("Penumbral lunar eclipse: only faint shading on the Moon", "Halbschatten-Mondfinsternis: nur eine leichte Abschattung des Mondes"),
  })[ec.type] + tl(`, around ${fmtTime(here.t)}`, `, gegen ${fmtTime(here.t)}`);
  const pct = Math.max(5, Math.round(here.cov * 20) * 5), elsewhere = { T: tl("total", "total"), A: tl("annular", "ringförmig"), H: tl("total or annular", "total oder ringförmig") }[ec.type];
  return tl(`Partial solar eclipse: about ${pct}% of the Sun covered around ${fmtTime(here.t)}${elsewhere ? ` (${elsewhere} elsewhere)` : ""}. Only ever look with eclipse glasses.`,
            `Partielle Sonnenfinsternis: etwa ${pct} % der Sonne bedeckt, gegen ${fmtTime(here.t)}${elsewhere ? ` (anderswo ${elsewhere})` : ""}. Nur mit Finsternisbrille hinsehen.`);
}

// ---------- aurora: NOAA's Kp index forecast (3-hour blocks), read straight from NOAA ----------
// The aurora reaches further from the poles the higher Kp goes: roughly 2.2° of geomagnetic latitude
// per step, low on the horizon from about 66° at Kp 0. So in southern Germany it takes Kp 7 to 8.
let aurora = null, auroraLoading = false;
async function loadAurora() {
  const saved = store.get("aurora", null);
  if (saved) aurora = saved.list;
  if (auroraLoading || (saved && Date.now() - saved.at < 3600e3)) return;
  auroraLoading = true;
  try {
    const r = await fetchT("https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json", 10000);
    const rows = await r.json();
    aurora = rows.filter(x => x && x.time_tag && typeof x.kp === "number").map(x => ({ t: Date.parse(x.time_tag + "Z"), kp: x.kp, kind: x.observed }));
    store.set("aurora", { at: Date.now(), list: aurora });
  } catch {}
  auroraLoading = false;
  if (S.tab === "tonight") renderSheet();
}
function geomagLat(lat, lon) {   // tilted-dipole geomagnetic latitude (north geomagnetic pole near 80.8° N, 72.8° W)
  const p = 80.8 * D2R, po = -72.8 * D2R, f = lat * D2R, l = lon * D2R;
  return 90 - Math.acos(Math.max(-1, Math.min(1, Math.sin(f) * Math.sin(p) + Math.cos(f) * Math.cos(p) * Math.cos(l - po)))) * R2D;
}
function auroraOutlook(win) {
  if (!aurora || !aurora.length || !S.loc) return null;
  const ml = geomagLat(S.loc.lat, S.loc.lon), need = Math.max(0, (66 - Math.abs(ml)) / 2.2);
  const tonight = aurora.filter(b => b.t + 3 * 3600e3 > win.start && b.t < win.end), best = tonight.reduce((a, b) => !a || b.kp > a.kp ? b : a, null);
  const now = aurora.filter(b => b.t <= Date.now()).pop() || null;
  return { need, best, now, north: ml >= 0, side: ml >= 0 ? tl("north", "Norden") : tl("south", "Süden") };
}
function auroraText(o) {
  if (!o.best) return tl("No forecast for tonight yet.", "Noch keine Vorhersage für heute Nacht.");
  const kp = fmtN(o.best.kp, 1), need = fmtN(Math.round(o.need * 2) / 2, 1);
  if (o.best.kp >= o.need) return tl(`Possible! Kp up to ${kp} around ${fmtTime(o.best.t + 90 * 60e3)}: look low in the ${o.side}, away from lights`,
                                     `Möglich! Kp bis ${kp} gegen ${fmtTime(o.best.t + 90 * 60e3)}: schau tief nach ${o.side}, weg von Lichtern`);
  if (o.best.kp >= o.need - 1) return tl(`A camera might catch a faint glow low in the ${o.side} (Kp up to ${kp}; about ${need} needed here)`,
                                         `Eine Kamera könnte ein schwaches Leuchten tief im ${o.side} einfangen (Kp bis ${kp}; hier etwa ${need} nötig)`);
  return tl(`Unlikely here tonight (Kp up to ${kp}; about ${need} needed)`, `Heute Nacht hier unwahrscheinlich (Kp bis ${kp}; etwa ${need} nötig)`);
}

// ---------- comets: orbits for the brightest ones (data/comets.json, from NASA JPL, built daily) ----------
let comets = null;
async function loadComets() {
  const url = new URL("data/comets.json", location.href).href, cache = await openCache();
  try {
    const r = await fetchT(url, 10000, { cache: "no-cache" });
    if (r.ok) { const text = await r.text(); comets = JSON.parse(text).comets || []; if (cache) { try { await cache.put(url, new Response(text)); } catch {} } }
  } catch {}
  if (!comets && cache) { try { const r = await cache.match(url); if (r) comets = (await r.json()).comets || []; } catch {} }
  if (S.tab === "tonight") renderSheet();
}
const GAUSS_K = 0.01720209895;   // radians a day for 1 AU around the Sun
// Heliocentric ecliptic position (AU, J2000) of a comet at a Julian date, for any orbit shape.
function cometHelio(c, jdNow) {
  const dt = jdNow - c.tp, q = c.q, e = c.e;
  let nu, r;
  if (Math.abs(e - 1) < 1e-4) {   // parabola (Barker's equation)
    const W = 3 * GAUSS_K / Math.sqrt(2 * q * q * q) * dt, Y = Math.cbrt(W / 2 + Math.sqrt(W * W / 4 + 1)), s = Y - 1 / Y;
    nu = 2 * Math.atan(s); r = q * (1 + s * s);
  } else if (e < 1) {             // ellipse
    const a = q / (1 - e);
    let M = (GAUSS_K / Math.pow(a, 1.5) * dt) % (2 * Math.PI); if (M > Math.PI) M -= 2 * Math.PI; if (M < -Math.PI) M += 2 * Math.PI;
    let E = e > 0.8 ? (M < 0 ? -Math.PI : Math.PI) : M;
    for (let k = 0; k < 50; k++) { const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= dE; if (Math.abs(dE) < 1e-12) break; }
    nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2)); r = a * (1 - e * Math.cos(E));
  } else {                        // hyperbola
    const a = q / (e - 1), M = GAUSS_K / Math.pow(a, 1.5) * dt;
    let H = Math.asinh(M / e);
    for (let k = 0; k < 60; k++) { const dH = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1); H -= dH; if (Math.abs(dH) < 1e-12) break; }
    nu = 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2)); r = a * (e * Math.cosh(H) - 1);
  }
  const O = c.om * D2R, i = c.i * D2R, u = c.w * D2R + nu;
  return { r, x: r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(i)),
           y: r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(i)), z: r * Math.sin(u) * Math.sin(i) };
}
// Where a comet is on the sky and how bright it should be (total magnitude M1 + 5 log Δ + K1 log r).
function cometAt(c, date) {
  const T = (jd(date) - 2451545) / 36525, earth = heliocentric(EARTH_ORBIT, T), h = cometHelio(c, jd(date));
  const g = [h.x - earth[0], h.y - earth[1], h.z - earth[2]], delta = Math.hypot(...g);
  const { ra, dec } = eclToEq(Math.atan2(g[1], g[0]) + precession(date), Math.asin(g[2] / delta));
  return { ra, dec, mag: c.M1 + 5 * Math.log10(delta) + c.K1 * Math.log10(h.r), r: h.r, delta };
}
function cometsTonight(t0) {
  const win = sunBelow(t0, -12); if (!win || !comets) return [];
  const out = [];
  for (const c of comets) {
    let best = null;
    for (let t = win.start; t <= win.end; t += 20 * 60e3) {
      const p = cometAt(c, new Date(t)), a = altAzAt(p.ra, p.dec, t);
      if (a.el > 10 && p.mag <= 9 && (!best || a.el > best.el)) best = { ...a, t, mag: p.mag };
    }
    if (best) out.push({ name: c.name, best });
  }
  return out.sort((a, b) => a.best.mag - b.best.mag);
}
const cometText = c => tl(`${c.name}: magnitude ${fmtN(c.best.mag, 1)}, ${c.best.mag <= 5.5 ? "visible to the eye in a dark sky" : "binoculars"}; best around ${fmtTime(c.best.t)} ${whereWord(c.best.az, c.best.el)}`,
                          `${c.name}: Magnitude ${fmtN(c.best.mag, 1)}, ${c.best.mag <= 5.5 ? "an dunklem Himmel mit bloßem Auge" : "Fernglas"}; am besten gegen ${fmtTime(c.best.t)} ${whereWord(c.best.az, c.best.el)}`);

// ---------- putting it together, worked out at most once every 20 minutes ----------
let guideCache = null;
function skyGuide() {
  if (!S.loc) return null;
  const key = `${S.loc.lat},${S.loc.lon},${!!aurora},${comets ? comets.length : -1}`, now = Date.now();
  if (guideCache && guideCache.key === key && now - guideCache.at < 20 * 60e3) return guideCache.data;
  const win = sunBelow(now, -6) || { start: now, end: now + 12 * 3600e3 };
  const pairs = pairsAhead(now, 14), tonightEnd = win.end;
  const data = {
    planets: planetsTonight(now), showers: showersTonight(now), comets: cometsTonight(now), aurora: auroraOutlook(win),
    pairsTonight: pairs.filter(p => p.t <= tonightEnd),
    coming: [
      ...pairs.filter(p => p.t > tonightEnd).map(p => ({ t: p.t, text: pairText(p) })),
      ...moonPhasesAhead(now, 30).map(m => ({ t: m.t, text: m.full ? tl("Full Moon: bright nights, fainter satellites hard to see", "Vollmond: helle Nächte, schwächere Satelliten schwer zu sehen")
                                                                : tl("New Moon: the darkest nights of the month", "Neumond: die dunkelsten Nächte des Monats") })),
      ...SHOWERS.map(s => showerAt(s, now)).map((sh, i) => ({ sh, s: SHOWERS[i] })).filter(({ sh }) => sh.days < -0.75 && sh.days > -30)
        .map(({ sh, s }) => ({ t: sh.peak, text: tl(`${sh.name} peak: up to ${s[5]} meteors an hour in a perfect sky`, `Höhepunkt der ${sh.name}: bis zu ${s[5]} Meteore pro Stunde bei perfektem Himmel`) })),
      ...ECLIPSES.filter(ec => ec.t > now && ec.t < now + 450 * DAY).map(ec => ({ ec, here: eclipseHere(ec) })).filter(x => x.here)
        .map(({ ec, here }) => ({ t: here.t, text: eclipseText(ec, here), long: true })),
    ].sort((a, b) => a.t - b.t),
  };
  guideCache = { key, at: now, data };
  return data;
}

// Lines for the Tonight overview (the same style as Dark, Clouds, Seeing, Moon).
function skyGuideLines() {
  const g = skyGuide(); if (!g) return "";
  const line = (k, v) => `<div class="tn-line"><span class="tn-k">${k}</span><span>${v}</span></div>`;
  let html = "";
  if (g.planets.length) html += line(tl("Planets", "Planeten"), g.planets.map(p => `${esc(skyName(p.name))} ${planetWhen(p)}, ${whereWord(p.best.az, p.best.el)}`).join("<br>"));
  if (g.pairsTonight.length) html += line(tl("Pairs", "Paare"), g.pairsTonight.map(p => `${pairText(p)} ${tl("around", "gegen")} ${fmtTime(p.t)}`).join("<br>"));
  if (g.showers.length) html += line(tl("Meteors", "Meteore"), g.showers.map(showerText).join("<br>"));
  if (g.comets.length) html += line(tl("Comets", "Kometen"), g.comets.map(cometText).map(esc).join("<br>"));
  if (g.aurora) html += line(tl("Aurora", "Polarlicht"), auroraText(g.aurora));
  return html;
}
function skyGuideComing() {
  const g = skyGuide(); if (!g || !g.coming.length) return "";
  return `<h4 class="tn-h">${tl("Coming up", "Demnächst")}</h4><div class="coming">` +
    g.coming.map(c => `<div class="up-line"><span class="up-d">${dayDate(c.t)}</span><span>${c.text}</span></div>`).join("") + `</div>`;
}

// ---------- on the sky: shower radiants, comets and a possible aurora (worked out once a second) ----------
function computeSkyGuide(date, gmst, lat, lon) {
  const place = (ra, dec) => { const a = raDecToAltAz(ra, dec, gmst, lat, lon); return { ...a, v: enu(a.az, a.el) }; };
  sky.radiants = SHOWERS.map(s => showerAt(s, +date)).filter(sh => sh.active && sh.zhr >= 5).map(sh => ({ name: sh.name, ...place(sh.radiant.ra, sh.radiant.dec) }));
  sky.comets = (comets || []).map(c => ({ c, p: cometAt(c, date) })).filter(x => x.p.mag <= 9.5).map(({ c, p }) => ({ name: c.name, mag: p.mag, ...place(p.ra, p.dec) }));
  const o = aurora && S.loc ? auroraOutlook({ start: +date, end: +date + 3600e3 }) : null;
  sky.aurora = o && o.now && o.now.kp >= o.need - 0.5 && sky.sunEl < -10 ? (o.north ? 0 : 180) : null;
}
function drawSkyGuide(P) {
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  if (sky.aurora != null) {   // a soft green band along the horizon on the pole side
    ctx.strokeStyle = "rgba(90, 230, 150, 0.22)"; ctx.lineWidth = 14; ctx.beginPath();
    let pen = false;
    for (let a = -60; a <= 60; a += 5) {
      const q = P(enu(sky.aurora + a, 6)); if (!q.front) { pen = false; continue; }
      if (pen) ctx.lineTo(q.x, q.y); else { ctx.moveTo(q.x, q.y); pen = true; }
    }
    ctx.stroke(); ctx.lineWidth = 1;
    const q = P(enu(sky.aurora, 12)); if (q.front) { ctx.font = `600 11px ${FONT_M}`; ctx.fillStyle = "rgba(120, 240, 170, 0.9)"; ctx.fillText(tl("AURORA?", "POLARLICHT?"), q.x - 30, q.y); }
  }
  ctx.font = `10px ${FONT_M}`;
  for (const r of sky.radiants || []) {   // a little burst where the meteors seem to come from
    if (r.el < 0) continue;
    const q = P(r.v); if (!q.front) continue;
    ctx.strokeStyle = C.moon; ctx.globalAlpha = 0.7; ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.moveTo(q.x + 4 * Math.cos(a), q.y + 4 * Math.sin(a)); ctx.lineTo(q.x + 9 * Math.cos(a), q.y + 9 * Math.sin(a)); }
    ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = C.moon; ctx.fillText(r.name, q.x + 12, q.y + 4);
  }
  for (const c of sky.comets || []) {     // a fuzzy head with a short tail pointing away from the Sun
    if (c.el < -1) continue;
    const q = P(c.v); if (!q.front) continue;
    const s = P([c.v[0] + 0.01 * sky.sunV[0], c.v[1] + 0.01 * sky.sunV[1], c.v[2] + 0.01 * sky.sunV[2]]);
    const ang = Math.atan2(q.y - s.y, q.x - s.x);
    ctx.strokeStyle = C.star; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + 18 * Math.cos(ang), q.y + 18 * Math.sin(ang)); ctx.stroke();
    ctx.lineWidth = 1; ctx.globalAlpha = 1; ctx.fillStyle = C.star; ctx.shadowColor = C.star; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(q.x, q.y, 2.5, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillText(`${c.name} · ${fmtN(c.mag, 1)}`, q.x + 7, q.y - 6);
  }
}
