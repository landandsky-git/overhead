// Overhead: Satellite data: downloading, parsing and brightness table.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// ---------- satellite data ----------
const TLE_MAX_AGE = 6 * 3600e3;
// CSV ("OMM") rather than the classic two-line text: the text format only has room for 5-digit
// catalog numbers, so CelesTrak leaves out everything numbered above 99999 (launched since mid-2026).
const groupUrl = g => `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=csv`;

function parseTLE(text) {
  const lines = text.split(/\r?\n/).map(l => l.trimEnd()).filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length; ) {
    if (lines[i + 1]?.startsWith("1 ") && lines[i + 2]?.startsWith("2 ")) {
      out.push({ name: lines[i].trim(), l1: lines[i + 1], l2: lines[i + 2] }); i += 3;
    } else i++;
  }
  return out;
}

// Catalog numbers above 99999 are written as a letter plus four digits ("Alpha-5"), skipping I and O.
const ALPHA5 = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const toAlpha5 = n => n < 100000 ? String(n).padStart(5, "0") : ALPHA5[Math.floor(n / 10000) - 10] + String(n % 10000).padStart(4, "0");
const fromAlpha5 = s => /^[A-Z]/.test(s) ? (ALPHA5.indexOf(s[0]) + 10) * 10000 + +s.slice(1) : +s;
function tleChecksum(line) { let s = 0; for (const ch of line) s += ch >= "0" && ch <= "9" ? +ch : ch === "-" ? 1 : 0; return s % 10; }
// Two-line "assumed decimal point" notation: 0.000136016 -> " 13602-3"
function tleExp(v) {
  if (!v) return " 00000+0";
  let e = Math.floor(Math.log10(Math.abs(v))) + 1, m = Math.round(Math.abs(v) / 10 ** e * 1e5);
  if (m >= 1e5) { m = 1e4; e++; }
  if (e < -9 || e > 9) return " 00000+0";
  return (v < 0 ? "-" : " ") + String(m).padStart(5, "0") + (e < 0 ? "-" : "+") + Math.abs(e);
}
// One CelesTrak CSV row as the two lines the orbit library reads (column layout of the classic format).
function ommToTLE(o) {
  const num = toAlpha5(+o.NORAD_CAT_ID), f = (v, w, d) => (+v).toFixed(d).padStart(w);
  const id = /^\d{2}(\d{2})-(\d{3})(\w*)$/.exec(o.OBJECT_ID || "");
  const t = new Date(o.EPOCH + "Z"), y = t.getUTCFullYear(), day = (t - Date.UTC(y, 0, 1)) / 86400e3 + 1;
  const ndot = +o.MEAN_MOTION_DOT || 0;
  const l1 = `1 ${num}${o.CLASSIFICATION_TYPE || "U"} ${(id ? id[1] + id[2] + id[3] : "").padEnd(8).slice(0, 8)} ` +
    `${String(y % 100).padStart(2, "0")}${day.toFixed(8).padStart(12, "0")} ${ndot < 0 ? "-" : " "}${Math.min(Math.abs(ndot), 0.99999999).toFixed(8).slice(1)} ` +
    ` 00000+0 ${tleExp(+o.BSTAR || 0)} 0 ${String((+o.ELEMENT_SET_NO || 0) % 10000).padStart(4)}`;
  const l2 = `2 ${num} ${f(o.INCLINATION, 8, 4)} ${f(o.RA_OF_ASC_NODE, 8, 4)} ${String(Math.round(+o.ECCENTRICITY * 1e7)).padStart(7, "0")} ` +
    `${f(o.ARG_OF_PERICENTER, 8, 4)} ${f(o.MEAN_ANOMALY, 8, 4)} ${f(o.MEAN_MOTION, 11, 8)}${String((+o.REV_AT_EPOCH || 0) % 100000).padStart(5)}`;
  return { name: o.OBJECT_NAME, l1: l1 + tleChecksum(l1), l2: l2 + tleChecksum(l2) };
}
// One CSV line into cells; commas inside quoted names are kept.
function csvCells(line) {
  const out = []; let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) { if (ch !== '"') cur += ch; else if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false; }
    else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
function parseCSV(text) {
  const [head, ...rows] = text.split(/\r?\n/).filter(Boolean).map(csvCells);
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const isOMM = text => /^OBJECT_NAME,.*MEAN_MOTION/.test(text);
// Orbits from either format: CelesTrak CSV (current) or classic two-line text (the bundled fallback file).
const parseOrbits = text => isOMM(text) ? parseCSV(text).filter(o => o.NORAD_CAT_ID && o.MEAN_MOTION).map(ommToTLE) : parseTLE(text);

async function openCache() { try { return await caches.open("overhead-tle-v1"); } catch { return null; } }

// Where the lists come from, in order:
//   1. this website's own copy in data/, refreshed from CelesTrak every 4 hours by GitHub (no limit);
//   2. CelesTrak itself, which allows each internet connection one download of a list every 2 hours
//      and answers later requests with a short note;
//   3. the last good copy saved on this phone.
let lastRefusal = null;
// fetch that gives up if the server hasn't started answering within ms (weak signal outdoors);
// once it answers, the download itself may take as long as it needs.
async function fetchT(url, ms = 10000, opts = {}) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); } finally { clearTimeout(timer); }
}
async function getGroup(g, force) {
  const url = groupUrl(g), key = "tleTime_" + g, failKey = "tleFail_" + g, time = store.get(key, 0);
  const cache = await openCache();
  // stale = a fresh download was tried and failed, so this is the copy saved earlier
  const cached = async stale => {
    if (!cache) return null;
    try { const r = await cache.match(url); return r ? { text: await r.text(), time, stale } : null; } catch { return null; }
  };
  const save = async text => {
    if (cache) { try { await cache.put(url, new Response(text)); } catch {} }
    store.set(key, Date.now());
    return { text, time: Date.now() };
  };
  if (!force && Date.now() - time < TLE_MAX_AGE) { const c = await cached(false); if (c) return c; }
  try {
    const r = await fetchT(`data/${g}.csv`, 10000, { cache: "no-cache" });
    if (r.ok) { const text = await r.text(); if (isOMM(text)) return await save(text); }
  } catch {}
  if (!force && Date.now() - store.get(failKey, 0) < 2 * 3600e3) { lastRefusal = "wait"; return await cached(true); }
  try {
    const r = await fetchT(url, 15000);
    const text = await r.text();
    if (!isOMM(text)) { lastRefusal = /not updated/i.test(text) ? "wait" : "error"; throw new Error("no data"); }
    return await save(text);
  } catch {
    if (!lastRefusal) lastRefusal = "offline";
    store.set(failKey, Date.now());
    return await cached(true);
  }
}

let loadJob = 0;
async function loadSats(force) {
  const job = ++loadJob;
  S.gen++; S.passJob++;
  worker.postMessage({ type: "reset" });
  S.sats = []; S.byId = new Map(); S.counts = { bright: 0, starlink: 0, other: 0 }; S.trains = new Map();
  S.now = []; S.nowMap = new Map(); S.passes = null; S.passesAt = 0; paths.clear();
  S.loading = tl("Loading satellites…", "Satelliten werden geladen…"); S.busy = true; updateStatus();
  S.mags = await getMags(force);
  if (job !== loadJob) return;
  const times = [];
  let bright = [];
  for (const g of ["stations", "visual"]) {
    const r = await getGroup(g, force);
    if (job !== loadJob) return;
    if (r) { bright.push(...parseOrbits(r.text)); times.push(r.time); }
  }
  if (!bright.length) { try { bright = parseOrbits(await (await fetch("tle-fallback.txt")).text()); } catch {} }
  addSats(bright, "bright");
  S.times = times;
  await loadActive(force);
}

// Starlink and every other active satellite: one big list, added after the bright ones.
async function loadActive(force) {
  const job = loadJob;
  S.loading = tl("Loading Starlink and other satellites…", "Starlink und weitere Satelliten werden geladen…"); S.busy = true; updateStatus(); renderSheet(); updateCard();
  lastRefusal = null;
  const act = await getGroup("active", force);
  if (job !== loadJob) return;
  S.busy = false;
  if (act) { addSats(parseOrbits(act.text), null); S.times.push(act.time); S.passesAt = 0; }   // redo passes to include bright ones from this list
  S.tleTime = S.times.length ? Math.min(...S.times) : 0;
  const ageDays = act ? (Date.now() - act.time) / 86400e3 : 0;
  S.loading = !act ? (lastRefusal === "wait"
      ? tl("Starlink and other satellites will load within 2 hours (CelesTrak download limit)", "Starlink und weitere Satelliten laden innerhalb von 2 Stunden (Download-Limit von CelesTrak)")
      : tl("Showing bright satellites only (couldn't download the full list)", "Nur helle Satelliten (die vollständige Liste ließ sich nicht laden)"))
    : act.stale && ageDays > 10 ? tl(`No connection. The saved satellite data is ${Math.round(ageDays)} days old, so positions may be off by several degrees. Connect to update.`,
                                     `Keine Verbindung. Die gespeicherten Satellitendaten sind ${Math.round(ageDays)} Tage alt, die Positionen können daher um mehrere Grad abweichen. Verbinde dich zum Aktualisieren.`)
    : act.stale && Date.now() - act.time > TLE_MAX_AGE ? tl(`No connection. Using satellite data saved ${fmtDate(new Date(act.time))}, ${fmtTime(act.time)}. It stays accurate for about a week.`,
                                                            `Keine Verbindung. Die App nutzt die Satellitendaten vom ${fmtDate(new Date(act.time))}, ${fmtTime(act.time)} Uhr. Sie bleiben etwa eine Woche lang genau.`)
    : "";
  updateStatus(); updateTleInfo(); renderSheet(); updateCard();
}

function addSats(list, cat) {
  const out = [];
  for (const t of list) {
    const id = t.l1.slice(2, 7).trim();
    if (S.byId.has(id)) continue;
    const raw = t.name.replace(/^0 /, "").trim();
    // CelesTrak lists the modules docked to the space stations separately; they fly as one object.
    if (/^(ISS|CSS) \((?!ZARYA|TIANHE)/.test(raw)) continue;
    const c = cat || (/^STARLINK/i.test(raw) ? "starlink" : "other");
    const sat = { idx: S.sats.length, id, raw, name: prettyName(raw), nameU: raw.toUpperCase(), l1: t.l1, l2: t.l2, cat: c };
    [sat.m0, sat.m0src] = stdMag(sat);
    if (isFreshStarlink(sat)) { sat.trainKey = t.l1.slice(9, 14).trim(); S.trains.set(sat.trainKey, (S.trains.get(sat.trainKey) || 0) + 1); }
    sat.m0base = sat.m0; sat.m0 += sightingCorrection(sat);   // the viewer's own sightings (sightings.js)
    S.sats.push(sat); S.byId.set(id, sat); S.counts[c]++;
    out.push([t.l1, t.l2, sat.m0]);
  }
  worker.postMessage({ type: "add", list: out });
  updateTleInfo();
}

// Typical brightness (magnitude 1,000 km away, half lit) and where the value comes from:
// measured catalog value, then published values for well-studied families, then radar size,
// then rough values by type.
function stdMag(sat) {
  const M = S.mags || {};
  if (M.m && M.m[sat.id] != null) return [M.m[sat.id], "measured"];
  const sl = starlinkMag(sat);
  if (sl != null) return [sl, "family"];
  for (const [re, m, sure] of CODES.STD_MAG || []) if (sure && re.test(sat.nameU)) return [m, "family"];
  if (M.r && M.r[sat.id] != null) return [M.r[sat.id], "radar"];
  for (const [re, m, sure] of CODES.STD_MAG || []) if (!sure && re.test(sat.nameU)) return [m, "type"];
  return [sat.cat === "bright" ? 4.0 : 5.5, "type"];
}
// Starlink by generation (from the satellite number), from published measurements (Mallama et al.).
// Newly launched ones still climbing to their working orbit (below about 400 km) fly in a much brighter
// attitude: that's what makes fresh "trains" so visible. "Newly launched" comes from the launch dates
// in data/mags.json, or without it from the satellite number (the newest generation).
function starlinkMag(sat) {
  const m = /^STARLINK-(\d+)/.exec(sat.nameU);
  if (!m) return null;
  const num = +m[1], revPerDay = parseFloat(sat.l2.slice(52, 63)), n = revPerDay * 2 * Math.PI / 86400;
  const low = n > 0 && Math.cbrt(398600.4418 / (n * n)) - 6378.137 < 400;
  const isNew = S.mags && S.mags.new ? !!S.mags.new[sat.id] : num >= 30000;
  if (low && isNew) return 5.0;
  return num < 1500 ? 5.1 : num < 2000 ? 6.8 : num < 5000 ? 6.0 : 7.5;
}
const MAG_SOURCE = {
  measured: tl("Measured, from Mike McCants' satellite brightness catalog", "Gemessen, aus dem Helligkeitskatalog von Mike McCants"),
  family: tl("From published measurements of this kind of satellite", "Aus veröffentlichten Messungen dieser Art von Satellit"),
  radar: tl("Estimated from its radar size", "Geschätzt aus seiner Radargröße"),
  type: tl("Rough estimate for this type of object", "Grobe Schätzung für diese Art von Objekt"),
};

// The brightness table published next to the app (data/mags.json, rebuilt daily by GitHub).
async function getMags(force) {
  const url = new URL("data/mags.json", location.href).href, cache = await openCache();
  const cached = async () => { try { const r = cache && await cache.match(url); return r ? await r.json() : null; } catch { return null; } };
  if (!force && Date.now() - store.get("magsTime", 0) < 24 * 3600e3) { const c = await cached(); if (c) return c; }
  try {
    const r = await fetchT(url, 10000, { cache: "no-cache" });
    if (r.ok) {
      const text = await r.text(), j = JSON.parse(text);
      if (cache) { try { await cache.put(url, new Response(text)); } catch {} }
      store.set("magsTime", Date.now());
      return j;
    }
  } catch {}
  return await cached();
}

function prettyName(n) {
  const fixes = { "ISS (ZARYA)": "ISS", "CSS (TIANHE)": "Tiangong (CSS)", "HST": tl("Hubble Space Telescope", "Hubble-Weltraumteleskop") };
  return fixes[n] || n.replace(/\s+/g, " ");
}
