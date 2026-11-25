// Overhead: Status bar, the selection card and live pass guidance.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// ---------- UI ----------
// The hint line is a live region: it stays in the page and is emptied rather than hidden, so screen
// readers announce each new message.
function showHint(msg, ms) { const h = $("hint"); h.textContent = msg; clearTimeout(showHint.t); showHint.t = ms ? setTimeout(hideHint, ms) : 0; }
function hideHint() { clearTimeout(showHint.t); $("hint").textContent = ""; }

const upTitle = () => S.timeOffset ? tl(`Up at ${fmtTime(simNow())}`, `Am Himmel um ${fmtTime(simNow())}`, `На небі о ${fmtTime(simNow())}`) : tl("Up now", "Jetzt am Himmel", "Зараз на небі");
const visibleNow = () => { const L = limitNow(); return S.now.filter(e => e.el > 0 && S.show[e.sat.cat] && (!S.eyeOnly || (e.lit && e.mag <= L))); };

function updateStatus() {
  const bits = [];
  if (S.timeOffset) bits.push(`◷ ${fmtTime(simNow())}`);
  if (S.loc) bits.push(locName(S.loc) ? locName(S.loc).split(",")[0] : fmtLatLon(S.loc.lat, S.loc.lon));
  const up = visibleNow();
  if (sky.sunEl < -6) { const L = limitNow(); bits.push(`${fmtN(up.filter(e => e.lit && e.mag <= L).length)} ${tl("visible by eye", "mit bloßem Auge", "видно оком")}`); }
  bits.push(`${fmtN(up.length)} ${tl("up", "am Himmel", "на небі")}`);
  // Loading and download-limit messages get their own line so they aren't cut off on a phone.
  const notice = $("notice");
  if (notice.textContent !== S.loading) notice.textContent = S.loading;
  notice.hidden = !S.loading || !$("intro").hidden;
  if (S.tab === "now") $("sheetTitle").textContent = `${upTitle()} · ${fmtN(visibleNow().length)}`;
  if (S.loc && sky.sunEl > -6) bits.push(tl("sky still bright", "Himmel noch hell", "небо ще світле"));
  $("status").textContent = bits.join(" · ");
  const needFlat = S.mode === "sensor" && S.anyEvent && !S.lastSensor;
  if (needFlat && !S.flatHint) { S.flatHint = true; showHint(tl("Hold the phone flat for a moment to lock the compass.", "Halte das Handy kurz flach, damit sich der Kompass einstellt.", "Потримай телефон рівно кілька секунд, щоб компас налаштувався.")); }
  else if (!needFlat && S.flatHint) { S.flatHint = false; hideHint(); }
}

function aboutLine(sat) {
  const op = operatorOf(sat), c = catMem.get(sat.id), o = orbitInfo(sat), d = intlDesig(sat.l1);
  const who = op?.op || ownerName(c);
  const year = c?.launch ? c.launch.slice(0, 4) : d?.year;
  const bits = [], train = trainInfo(sat);
  const day = train && train.launch ? fmtDate(new Date(train.launch + "T00:00:00Z")) : "";
  if (train && train.size > 1) bits.push(tl(`one of ${train.size} Starlinks launched together${day ? ` on ${day}` : ""}, still climbing`,
                                            `einer von ${train.size} zusammen gestarteten Starlinks${day ? ` (${day})` : ""}, steigt noch`,
                                            `один із ${train.size} Starlink, запущених разом${day ? ` ${day}` : ""}, ще набирає висоту`));
  if (who) bits.push(who);
  if (year && !(train && train.launch)) bits.push(tl(`launched ${year}`, `gestartet ${year}`, `запущений ${year} року`));
  if (o) bits.push(`${o.short}, ${fmtN(Math.round((o.apo + o.peri) / 2))} ${tl("km up", "km hoch", "км над Землею")}`);
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
  setSheetOpen(false); updateCard();
}
const fmtCountdown = ms => {
  const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return h ? `${h} ${U.h} ${m} ${U.min}` : `${m}:${String(s % 60).padStart(2, "0")}`;
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
  const vis = p.visible ? (p.mag < 50 ? ` · ${magText(p.mag)}, ${brightWord(p.mag, p.limit)}` : "")
    : tl(" · not visible (in Earth's shadow or the sky is too bright)", " · nicht sichtbar (im Erdschatten oder der Himmel ist zu hell)", " · не видно (у тіні Землі або небо надто світле)");
  const rise = compassName(p.startAz), top = compassName(p.maxAz), el = p.maxEl.toFixed(0);
  if (now < p.start) {
    if (p.start - now <= 60e3 && p.start - now > 45e3) buzz("soon", [150], tl(`${name} rises in 1 minute in the ${rise}.`, `${name} geht in 1 Minute im ${rise} auf.`, `${name} зійде за 1 хвилину на ${rise}.`));
    const t = fmtCountdown(p.start - now);
    return [tl(`Rises in ${t} in the ${rise} (${p.startAz.toFixed(0)}°)`, `Geht in ${t} im ${rise} auf (${p.startAz.toFixed(0)}°)`, `Сходить через ${t} на ${rise} (${p.startAz.toFixed(0)}°)`),
            tl(`At ${fmtTime(p.start)}, highest ${el}° in the ${top} at ${fmtTime(p.maxTime)}${vis}`, `Um ${fmtTime(p.start)}, am höchsten (${el}°) im ${top} um ${fmtTime(p.maxTime)}${vis}`, `О ${fmtTime(p.start)}, найвище (${el}°) на ${top} о ${fmtTime(p.maxTime)}${vis}`)];
  }
  if (now - p.start < 30e3) buzz("rise", [200, 100, 200], tl(`${name} is rising now, low in the ${rise}.`, `${name} geht gerade auf, tief im ${rise}.`, `${name} саме сходить, низько на ${rise}.`));
  const where = n && n.el > 0 ? lookText(n) : tl(`Rising now in the ${rise}`, `Geht gerade im ${rise} auf`, `Саме сходить на ${rise}`);
  const next = now < p.maxTime ? tl(`Highest (${el}°) in ${fmtCountdown(p.maxTime - now)}`, `Am höchsten (${el}°) in ${fmtCountdown(p.maxTime - now)}`, `Найвище (${el}°) через ${fmtCountdown(p.maxTime - now)}`)
    : tl(`Sets in the ${compassName(p.endAz)} in ${fmtCountdown(p.end - now)}`, `Geht in ${fmtCountdown(p.end - now)} im ${compassName(p.endAz)} unter`, `Заходить на ${compassName(p.endAz)} через ${fmtCountdown(p.end - now)}`);
  return [where, `${next}${n && n.el > 0 ? ` · ${visText(n.lit, n.mag)}` : ""}`];
}
// "Look NE (45°), 30° up"
const lookText = n => tl(`Look ${compassName(n.az)} (${n.az.toFixed(0)}°), ${n.el.toFixed(0)}° up`, `Schau nach ${compassName(n.az)} (${n.az.toFixed(0)}°), ${n.el.toFixed(0)}° hoch`, `Дивись на ${compassName(n.az)} (${n.az.toFixed(0)}°), ${n.el.toFixed(0)}° над горизонтом`);

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
    where = lookText(n);
    const behind = behindSkyline(n.az, n.el) ? tl("behind your trees or rooftops · ", "hinter deinen Bäumen oder Dächern · ", "за твоїми деревами чи дахами · ") : "";
    meta = `${behind}${fmtKm(n.range)} ${tl("away", "entfernt", "від тебе")} · ${visText(n.lit, n.mag)}`;
  } else if (!S.loc) {
    where = tl("Set your location to see where it is", "Lege deinen Standort fest, um zu sehen, wo er ist", "Вкажи своє місцезнаходження, щоб побачити, де він"); meta = "";
  } else {
    where = tl("Below your horizon", "Unter deinem Horizont", "Під твоїм горизонтом");
    const p = nextPass(sat);
    meta = !p ? tl("Doesn't rise above 10° in the next 48 hours", "Steigt in den nächsten 48 Stunden nicht über 10°", "Не підніметься вище 10° у найближчі 48 годин")
      : tl(`Next rises ${fmtDayTime(p.start)} in the ${compassName(p.startAz)}, peaks ${p.maxEl.toFixed(0)}°${p.visible ? " (visible)" : ""}`,
           `Geht ${fmtDayTime(p.start)} im ${compassName(p.startAz)} auf, bis ${p.maxEl.toFixed(0)}° hoch${p.visible ? " (sichtbar)" : ""}`,
           `Наступний схід ${fmtDayTime(p.start)} на ${compassName(p.startAz)}, до ${p.maxEl.toFixed(0)}°${p.visible ? " (видно)" : ""}`);
  }
  $("cardWhere").textContent = where;
  $("cardMeta").textContent = meta;
  $("cardAbout").textContent = aboutLine(sat);
  $("cardShare").hidden = !(WATCH.sat === sat && WATCH.pass);   // a followed pass can be shared
  $("cardFb").hidden = !canAskSighting(sat, n);
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
