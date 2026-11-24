// Overhead: Status bar, the selection card and live pass guidance.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// ---------- UI ----------
function showHint(msg, ms) { const h = $("hint"); h.textContent = msg; h.hidden = false; clearTimeout(showHint.t); showHint.t = ms ? setTimeout(() => h.hidden = true, ms) : 0; }

const upTitle = () => S.timeOffset ? `Up at ${fmtTime(simNow())}` : "Up now";
const visibleNow = () => { const L = limitNow(); return S.now.filter(e => e.el > 0 && S.show[e.sat.cat] && (!S.eyeOnly || (e.lit && e.mag <= L))); };

function updateStatus() {
  const bits = [];
  if (S.timeOffset) bits.push(`◷ ${fmtTime(simNow())}`);
  if (S.loc) bits.push(S.loc.name ? S.loc.name.split(",")[0] : fmtLatLon(S.loc.lat, S.loc.lon));
  const up = visibleNow();
  if (sky.sunEl < -6) { const L = limitNow(); bits.push(`${up.filter(e => e.lit && e.mag <= L).length.toLocaleString("en")} visible by eye`); }
  bits.push(`${up.length.toLocaleString("en")} up`);
  // Loading and download-limit messages get their own line so they aren't cut off on a phone.
  const notice = $("notice");
  if (notice.textContent !== S.loading) notice.textContent = S.loading;
  notice.hidden = !S.loading || !$("intro").hidden;
  if (S.tab === "now") $("sheetTitle").textContent = `${upTitle()} · ${visibleNow().length.toLocaleString("en")}`;
  if (S.loc && sky.sunEl > -6) bits.push("sky still bright");
  $("status").textContent = bits.join(" · ");
  const needFlat = S.mode === "sensor" && S.anyEvent && !S.lastSensor;
  if (needFlat && !S.flatHint) { S.flatHint = true; showHint("Hold the phone flat for a moment to lock the compass."); }
  else if (!needFlat && S.flatHint) { S.flatHint = false; $("hint").hidden = true; }
}

function aboutLine(sat) {
  const op = operatorOf(sat), c = catMem.get(sat.id), o = orbitInfo(sat), d = intlDesig(sat.l1);
  const who = op?.op || ownerName(c);
  const year = c?.launch ? c.launch.slice(0, 4) : d?.year;
  const bits = [], train = trainInfo(sat);
  if (train && train.size > 1) bits.push(`one of ${train.size} Starlinks launched together${train.launch ? ` on ${fmtDate(new Date(train.launch + "T00:00:00Z"))}` : ""}, still climbing`);
  if (who) bits.push(who);
  if (year && !(train && train.launch)) bits.push(`launched ${year}`);
  if (o) bits.push(`${o.short}, ${Math.round((o.apo + o.peri) / 2).toLocaleString("en")} km up`);
  return bits.join(" · ");
}

// --- live pass guidance: the whole path across the sky, a countdown, and a buzz when it rises ---
const WATCH = { sat: null, pass: null, arc: null, buzzed: new Set() };
// Direction every 10 seconds through a pass (plus a minute either side).
function passArc(sat, pass) {
  const r = rec(sat), pts = [];
  if (!r || !S.loc) return pts;
  const gd = observerGd(), step = Math.max(10e3, (pass.end - pass.start) / 200);
  for (let t = pass.start - 60e3; t <= pass.end + 60e3; t += step) {
    const d = new Date(t), pv = satellite.propagate(r, d);
    if (!pv || !pv.position) continue;
    const la = satellite.ecfToLookAngles(gd, satellite.eciToEcf(pv.position, satellite.gstime(d)));
    const az = ((la.azimuth * R2D) + 360) % 360, el = la.elevation * R2D;
    if (el > -0.5) pts.push({ t, az, el, v: enu(az, el) });
  }
  return pts;
}
function startWatch(sat, pass) {
  const o = orbitInfo(sat);
  if (!pass || (o && o.short === "GEO")) { stopWatch(); return; }   // geostationary ones don't rise or set
  Object.assign(WATCH, { sat, pass, arc: passArc(sat, pass), buzzed: new Set() });
}
function stopWatch() { Object.assign(WATCH, { sat: null, pass: null, arc: null }); }
// From a pass list: select the satellite, follow that pass, and show the sky.
function watchPass(sat, pass) {
  if (S.targetId !== sat.id) setTarget(sat.id, true);
  startWatch(sat, pass);
  closeDetails();
  $("sheet").classList.remove("open"); sheetH(); updateCard();
}
const fmtCountdown = ms => {
  const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return h ? `${h} h ${m} min` : `${m}:${String(s % 60).padStart(2, "0")}`;
};
// Countdown text for the followed pass, and a buzz (on phones that can vibrate) a minute before and at rise.
function watchText(sat, n) {
  const p = WATCH.pass, now = Date.now(), name = sat.name;
  if (now > p.end + 60e3) {   // over: follow the next one if it's within 6 hours
    const next = nextPass(sat);
    if (next && next.start - now < 6 * 3600e3) startWatch(sat, next); else stopWatch();
    return WATCH.pass ? watchText(sat, n) : null;
  }
  const buzz = (key, pattern, msg) => {
    if (WATCH.buzzed.has(key)) return;
    WATCH.buzzed.add(key);
    try { navigator.vibrate?.(pattern); } catch {}
    showHint(msg, 8000);
  };
  const vis = p.visible ? (p.mag < 50 ? ` · ${magText(p.mag)}, ${brightWord(p.mag, p.limit)}` : "") : " · not visible (in Earth's shadow or the sky is too bright)";
  if (now < p.start) {
    if (p.start - now <= 60e3 && p.start - now > 45e3) buzz("soon", [150], `${name} rises in 1 minute in the ${compassName(p.startAz)}.`);
    return [`Rises in ${fmtCountdown(p.start - now)} in the ${compassName(p.startAz)} (${p.startAz.toFixed(0)}°)`,
            `At ${fmtTime(p.start)}, highest ${p.maxEl.toFixed(0)}° in the ${compassName(p.maxAz)} at ${fmtTime(p.maxTime)}${vis}`];
  }
  if (now - p.start < 30e3) buzz("rise", [200, 100, 200], `${name} is rising now, low in the ${compassName(p.startAz)}.`);
  const where = n && n.el > 0 ? `Look ${compassName(n.az)} (${n.az.toFixed(0)}°), ${n.el.toFixed(0)}° up` : `Rising now in the ${compassName(p.startAz)}`;
  const next = now < p.maxTime ? `highest (${p.maxEl.toFixed(0)}°) in ${fmtCountdown(p.maxTime - now)}` : `sets in the ${compassName(p.endAz)} in ${fmtCountdown(p.end - now)}`;
  return [where, `${next[0].toUpperCase()}${next.slice(1)}${n && n.el > 0 ? ` · ${visText(n.lit, n.mag)}` : ""}`];
}

function updateCard() {
  const card = $("card");
  const sat = S.targetId ? S.byId.get(S.targetId) : null;
  if (!sat || ALIGN.on) { card.hidden = true; return; }
  card.hidden = false;
  $("cardName").textContent = sat.name;
  updateFavButtons();
  const n = S.nowMap.get(sat.idx);
  let where, meta;
  const watching = WATCH.sat === sat && WATCH.pass && !S.timeOffset ? watchText(sat, n) : null;
  if (watching) {
    [where, meta] = watching;
  } else if (n && n.el > 0) {
    where = `Look ${compassName(n.az)} (${n.az.toFixed(0)}°), ${n.el.toFixed(0)}° up`;
    meta = `${fmtKm(n.range)} away · ${visText(n.lit, n.mag)}`;
  } else if (!S.loc) {
    where = "Set your location to see where it is"; meta = "";
  } else {
    where = "Below your horizon";
    const p = nextPass(sat);
    meta = p ? `Next rises ${fmtDayTime(p.start)} in the ${compassName(p.startAz)}, peaks ${p.maxEl.toFixed(0)}°${p.visible ? " (visible)" : ""}` : "Doesn't rise above 10° in the next 48 hours";
  }
  $("cardWhere").textContent = where;
  $("cardMeta").textContent = meta;
  $("cardAbout").textContent = aboutLine(sat);
}

// Select a satellite. Unless a specific pass is about to be followed (keepWatch), follow its next
// pass automatically when that starts within 6 hours.
function setTarget(id, keepWatch) {
  if (trackBack && trackBack.sat.id !== id) trackBack = null;
  S.targetId = id || null;
  store.set("target", S.targetId);
  const sat = id ? S.byId.get(id) : null;
  if (!keepWatch) {
    stopWatch();
    if (sat && S.loc) { const p = nextPass(sat); if (p && p.start - Date.now() < 6 * 3600e3) startWatch(sat, p); }
  }
  if (sat) catalog(sat).then(() => { updateCard(); if (S.detailsId === sat.id) renderAbout(sat); }).catch(() => {});
  computePaths(); updateCard(); renderSheet();
}
