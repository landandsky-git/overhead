// Overhead: Sky taps and zoom, aligning, "What was that?" and Starlink trains.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// --- sky taps ---
let drag = null, dragMoved = false;
cv.addEventListener("click", e => {
  if (dragMoved) return;
  let best = -1, bd = 26 * 26;
  for (let k = 0; k < tapN; k++) { const d = (tapX[k] - e.clientX) ** 2 + (tapY[k] - e.clientY) ** 2; if (d < bd) { bd = d; best = tapI[k]; } }
  if (best < 0) return;
  const sat = S.sats[best];
  if (sat.id === S.targetId) openDetails(sat.id); else setTarget(sat.id);
});
// Zoom: mouse wheel, or two fingers pinching. Field of view from 110° (wide) to 8° (zoomed in).
const VFOV = { min: 8, max: 110, normal: 70 };
function setZoom(vfov) {
  S.vfov = Math.max(VFOV.min, Math.min(VFOV.max, vfov));
  if (Math.abs(S.vfov - VFOV.normal) < 2) S.vfov = VFOV.normal;   // snap back to normal
  const pill = $("zoomPill"), x = VFOV.normal / S.vfov;
  pill.hidden = S.vfov === VFOV.normal;
  pill.textContent = `${x >= 1 ? "×" + fmtN(x, 1) : tl("wide", "weit")} · ${tl("reset", "zurück")}`;
}
cv.addEventListener("wheel", e => { e.preventDefault(); setZoom(S.vfov * Math.exp(e.deltaY * 0.0015)); }, { passive: false });
$("zoomPill").addEventListener("click", () => setZoom(VFOV.normal));

const fingers = new Map();   // pointerId -> {x, y}
let pinch = null;            // {d0, v0}: finger spread and zoom when the pinch began
const spread = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
cv.addEventListener("pointerdown", e => {
  fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (fingers.size === 2) { pinch = { d0: spread(), v0: S.vfov }; drag = null; dragMoved = true; return; }
  drag = { x: e.clientX, y: e.clientY, az: S.view.az, el: S.view.el }; dragMoved = false;
});
addEventListener("pointermove", e => {
  if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && fingers.size >= 2) { setZoom(pinch.v0 * pinch.d0 / spread()); return; }
  if (!drag || S.mode !== "drag") return;
  const k = S.vfov / H, dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true;
  S.view.az = (drag.az - dx * k + 360) % 360;
  S.view.el = Math.max(-10, Math.min(90, drag.el + dy * k));
});
const fingerUp = e => {
  fingers.delete(e.pointerId);
  if (fingers.size < 2) pinch = null;
  if (!fingers.size) { drag = null; setTimeout(() => dragMoved = false, 0); }
};
addEventListener("pointerup", fingerUp);
addEventListener("pointercancel", fingerUp);


// --- aligning on a star, planet or the Moon ---
// The phone's compass is often 5-15 degrees off. Pointing at a real object and naming it gives the
// true direction, and the difference becomes the compass correction (S.corr).
async function startCamera() {
  if (ALIGN.stream) return true;   // already running (camera view)
  try {
    ALIGN.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    const v = $("cam"); v.srcObject = ALIGN.stream; v.hidden = false;
    await v.play();
    return true;
  } catch { stopCamera(); return false; }
}
function stopCamera() {
  if (ALIGN.stream) ALIGN.stream.getTracks().forEach(t => t.stop());
  ALIGN.stream = null;
  const v = $("cam"); v.srcObject = null; v.hidden = true;
}
// Where the phone points: the camera direction (out of the back), or the top edge when there is no camera.
function pointing() { const R = S.R; return ALIGN.edge ? [R[1], R[4], R[7]] : [-R[2], -R[5], -R[8]]; }
function alignCandidates() {
  const p = pointing(), list = [];
  for (const o of [sky.moon, ...sky.planets, ...sky.stars]) {
    if (!o || o.el < 3 || (o.kind === "planet" && o.mag > 2.5) || (o.kind === "star" && (o.mag > 2.5 || !o.name))) continue;
    const d = Math.acos(Math.max(-1, Math.min(1, p[0] * o.v[0] + p[1] * o.v[1] + p[2] * o.v[2]))) * R2D;
    if (d < 45) list.push({ o, d });
  }
  return list.sort((a, b) => a.d - b.d).slice(0, 5);
}
const KIND_LABEL = { moon: tl("the Moon", "Mond"), planet: tl("planet", "Planet"), star: tl("star", "Stern") };
const KIND_COLOR = { moon: "var(--moon)", planet: "var(--planet)", star: "var(--star)" };
function renderAlignList() {
  if (!ALIGN.on) return;
  const list = alignCandidates(), box = $("alignList"), key = list.map(c => c.o.name).join("|");
  // Rebuild only when the set of names changes, so a row doesn't vanish under your finger.
  if (key !== ALIGN.key) {
    ALIGN.key = key;
    box.innerHTML = list.length ? list.map(({ o }) => `
      <button class="row" data-name="${esc(o.name)}"><span class="dot" style="background:${KIND_COLOR[o.kind]}"></span>
      <span class="nm">${esc(skyName(o.name))}<span class="sub">${KIND_LABEL[o.kind]} · ${tl("magnitude", "Magnitude")} ${o.kind === "moon" ? "−12" : fmtN(o.mag, 1)}</span></span>
      <span class="num"><span class="dist"></span><span class="sub">${ALIGN.edge ? tl("from top edge", "von der Oberkante") : tl("from crosshair", "vom Fadenkreuz")}</span></span></button>`).join("")
      : `<div class="empty">${tl("No bright stars or planets near where the phone points. Turn toward one and it will appear here.", "Keine hellen Sterne oder Planeten in der Richtung, in die das Handy zeigt. Dreh dich zu einem hin, dann erscheint er hier.")}</div>`;
  }
  box.querySelectorAll(".row").forEach((row, i) => { row.querySelector(".dist").textContent = `${list[i].d.toFixed(0)}°`; });
}
async function openAlign() {
  if (S.mode !== "sensor" || !S.R) { showHint(tl("Aligning needs the motion sensors. Reload the page and tap Start instead of drag mode.", "Zum Ausrichten braucht die App die Bewegungssensoren. Lade die Seite neu und tippe auf Start statt auf „Ohne Sensoren“."), 6000); return; }
  ALIGN.on = true; ALIGN.key = "";
  $("alignBar").hidden = false; $("sheet").hidden = true; $("card").hidden = true;
  $("alignHelp").textContent = tl("Starting the camera…", "Kamera wird gestartet…");
  $("alignList").innerHTML = "";
  ALIGN.camera = await startCamera();
  if (!ALIGN.on) { stopCamera(); ALIGN.camera = false; return; }   // cancelled while the camera started
  ALIGN.edge = !ALIGN.camera;
  $("alignHelp").textContent = ALIGN.camera
    ? tl("Center a bright star, planet or the Moon in the crosshair, hold still, then tap its name.", "Bring einen hellen Stern, Planeten oder den Mond ins Fadenkreuz, halte still und tippe dann auf seinen Namen.")
    : tl("The camera isn't available, so aim the top edge of your phone at a bright star, planet or the Moon, like a pointer. Hold still, then tap its name.",
         "Die Kamera ist nicht verfügbar. Ziele deshalb mit der Oberkante des Handys wie mit einem Zeiger auf einen hellen Stern, Planeten oder den Mond. Halte still und tippe dann auf seinen Namen.");
  renderAlignList();
  ALIGN.timer = setInterval(renderAlignList, 400);
}
function closeAlign() {
  ALIGN.on = false; clearInterval(ALIGN.timer);
  if (!CAM.on) stopCamera();
  ALIGN.camera = false;
  $("alignBar").hidden = true; $("sheet").hidden = false;
  sheetH(); updateCard();
}
function alignOn(name) {
  const o = [sky.moon, ...sky.planets, ...sky.stars].find(x => x && x.name === name);
  if (!o) return;
  const p = pointing(), az = (Math.atan2(p[0], p[1]) * R2D + 360) % 360, el = Math.asin(Math.max(-1, Math.min(1, p[2]))) * R2D;
  const turn = angDiff(o.az, az);
  S.corr = Math.round(angDiff(S.corr + turn, 0) * 10) / 10;
  store.set("corr", S.corr);
  closeAlign();
  const heightOff = Math.abs(o.el - el), moon = o.kind === "moon", label = skyName(o.name), off = fmtN(Math.abs(turn), 1);
  showHint(tl(`Lined up on ${moon ? "the Moon" : label}. The compass was ${off}° off and is now corrected.`, `Auf ${moon ? "den Mond" : label} ausgerichtet. Der Kompass lag ${off}° daneben und ist jetzt korrigiert.`) +
    (heightOff > 8 ? tl(` Its height was ${heightOff.toFixed(0)}° off too, so make sure that was ${moon ? "the Moon" : label}.`, ` Auch die Höhe lag ${heightOff.toFixed(0)}° daneben. Prüfe, ob das wirklich ${moon ? "der Mond" : label} war.`) : ""), 7000);
}
$("alignBtn").addEventListener("click", () => ALIGN.on ? closeAlign() : openAlign());
$("alignCancel").addEventListener("click", closeAlign);
$("alignReset").addEventListener("click", () => {
  S.corr = 0; store.set("corr", 0); closeAlign();
  showHint(tl("Alignment removed. The app follows the phone's compass again.", "Ausrichtung entfernt. Die App folgt wieder dem Kompass des Handys."), 5000);
});
$("alignList").addEventListener("click", e => { const b = e.target.closest(".row"); if (b) alignOn(b.dataset.name); });

// --- "What was that?": which satellite crossed where you point, in the last 10 minutes ---
const IDENT = { on: false, job: 0, hits: [] };
let trackBack = null;   // the identified satellite's path around the moment it crossed: {sat, t, pts}
function openIdentify() {
  if (!S.loc || !S.R) { showHint(tl("Set your location first.", "Lege zuerst deinen Standort fest."), 4000); return; }
  IDENT.on = true;
  $("idBar").hidden = false; $("sheet").hidden = true; $("card").hidden = true;
  $("idList").innerHTML = "";
  $("idHelp").textContent = S.mode === "sensor"
    ? tl("Point the crosshair at where you saw it moving, then tap Search.", "Richte das Fadenkreuz dorthin, wo du es gesehen hast, dann tippe auf Durchsuchen.")
    : tl("Drag the sky so the crosshair is where you saw it moving, then tap Search.", "Zieh den Himmel so, dass das Fadenkreuz dort ist, wo du es gesehen hast, dann tippe auf Durchsuchen.");
}
function closeIdentify() { IDENT.on = false; $("idBar").hidden = true; $("sheet").hidden = false; sheetH(); updateCard(); }
function runIdentify() {
  const R = S.R, dir = [-R[2], -R[5], -R[8]], now = simNow();
  $("idList").innerHTML = `<div class="empty">${tl(`Checking ${fmtN(S.sats.length)} satellites…`, `${fmtN(S.sats.length)} Satelliten werden geprüft…`)}</div>`;
  worker.postMessage({ type: "lookback", t0: now - 10 * 60e3, t1: now, step: 10e3, dir, radius: 15, job: ++IDENT.job });
}
const agoText = t => { const m = Math.round((simNow() - t) / 60000); return m < 1 ? tl("just now", "gerade eben") : tl(`${m} min ago`, `vor ${m} Min.`); };
const headingOf = (a, b) => compassName((Math.atan2(b[0] - a[0], b[1] - a[1]) * R2D + 360) % 360);
function applyLookback(m) {
  if (m.job !== IDENT.job || !IDENT.on) return;
  IDENT.hits = m.hits.map(h => ({ ...h, sat: S.sats[h.idx] })).filter(h => h.sat);
  const seeable = h => h.lit && h.mag < limitNow();
  const row = (h, i) => `<button class="row ${seeable(h) ? "lit" : ""}" data-i="${i}"><span class="dot"></span>
      <span class="nm">${esc(h.sat.name)}<span class="sub tn-wrap">${agoText(h.t)} · ${tl(`${h.deg.toFixed(0)}° from your aim · heading ${headingOf(h.from, h.to)}`, `${h.deg.toFixed(0)}° neben deinem Ziel · Richtung ${headingOf(h.from, h.to)}`)}</span></span>
      <span class="num">${h.lit ? magText(h.mag) : tl("in shadow", "im Schatten")}<span class="sub">${h.lit ? brightWord(h.mag).split(",")[0] : tl("not visible", "nicht sichtbar")}</span></span></button>`;
  const good = IDENT.hits.map((h, i) => [h, i]).filter(([h]) => seeable(h)), rest = IDENT.hits.map((h, i) => [h, i]).filter(([h]) => !seeable(h));
  $("idList").innerHTML =
    (good.length ? `<h4>${tl("Most likely", "Am wahrscheinlichsten")}</h4>` + good.slice(0, 8).map(([h, i]) => row(h, i)).join("")
      : `<div class="empty">${tl("Nothing bright enough to see crossed there in the last 10 minutes. It may have been a plane, a meteor or a satellite flare. You can also aim again and search once more.",
                                 "In den letzten 10 Minuten ist dort nichts Sichtbares vorbeigezogen. Vielleicht war es ein Flugzeug, ein Meteor oder ein aufblitzender Satellit. Du kannst auch neu zielen und noch einmal suchen.")}</div>`) +
    (rest.length ? `<h4>${tl("Also crossed, but too faint or in Earth's shadow", "Auch vorbeigezogen, aber zu schwach oder im Erdschatten")}</h4>` + rest.slice(0, 5).map(([h, i]) => row(h, i)).join("") : "");
}
function chooseIdentified(h) {
  closeIdentify();
  setTarget(h.sat.id);
  const r = rec(h.sat), gd = observerGd(), pts = [];
  for (let t = h.t - 180e3; t <= h.t + 120e3; t += 10e3) {
    const d = new Date(t), pv = r && satellite.propagate(r, d);
    if (!pv || !pv.position) continue;
    const la = satellite.ecfToLookAngles(gd, satellite.eciToEcf(pv.position, satellite.gstime(d)));
    if (la.elevation > -0.01) pts.push({ t, v: enu(la.azimuth * R2D, la.elevation * R2D) });
  }
  trackBack = { sat: h.sat, t: h.t, pts };
  showHint(tl(`${h.sat.name} crossed there ${agoText(h.t)}. Its path is drawn on the sky.`, `${h.sat.name} ist dort ${agoText(h.t)} vorbeigezogen. Seine Bahn ist am Himmel eingezeichnet.`), 6000);
}
$("idBtn").addEventListener("click", openIdentify);
$("idCancel").addEventListener("click", closeIdentify);
$("idSearch").addEventListener("click", runIdentify);
$("idList").addEventListener("click", e => { const b = e.target.closest(".row"); if (b && IDENT.hits[+b.dataset.i]) chooseIdentified(IDENT.hits[+b.dataset.i]); });
// The identified satellite's path, with an arrow showing which way it went and where it crossed.
function drawTrackBack(R, f, th, P) {
  const tb = trackBack, pts = tb.pts;
  if (pts.length < 2) return;
  ctx.strokeStyle = C.target; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
  polyline(pts, R, f, th); ctx.lineWidth = 1; ctx.globalAlpha = 1;
  const i = pts.findIndex(p => p.t >= tb.t), a = pts[Math.max(0, i - 1)], b = pts[Math.max(1, i)];
  const qa = P(a.v), qb = P(b.v);
  if (qa.front && qb.front) {
    const ang = Math.atan2(qb.y - qa.y, qb.x - qa.x);
    ctx.save(); ctx.translate(qb.x, qb.y); ctx.rotate(ang);
    ctx.fillStyle = C.target; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.font = `600 11px ${FONT_M}`; ctx.fillStyle = C.target; ctx.textAlign = "left";
    ctx.fillText(tl(`here at ${fmtTime(tb.t)}`, `hier um ${fmtTime(tb.t)}`), qb.x + 10, qb.y + 14);
  }
}

// --- Starlink trains: satellites from one recent launch still flying in a line ---
// trainKey = launch year + number, set for Starlinks launched recently that are still low (climbing).
function isFreshStarlink(sat) { return /^STARLINK/.test(sat.nameU) && sat.m0 === 5.0 && sat.m0src === "family"; }
function trainInfo(sat) {
  if (!sat.trainKey) return null;
  const launch = S.mags && S.mags.new ? S.mags.new[sat.id] : null;
  return { size: S.trains.get(sat.trainKey) || 1, launch };
}
// Satellites from one launch fly as a tight line only for the first days, then spread along the
// orbit. So a train is three or more sunlit ones from the same launch within 12 degrees of the next.
function trainClusters() {
  const groups = new Map();
  for (const e of S.now) {
    if (!e.sat.trainKey || e.el < 0 || !e.lit || e.frame !== frameNo) continue;
    if (!groups.has(e.sat.trainKey)) groups.set(e.sat.trainKey, []);
    groups.get(e.sat.trainKey).push(e);
  }
  const near = Math.cos(12 * D2R), out = [];
  for (const members of groups.values()) {
    const left = new Set(members);
    while (left.size) {
      const first = left.values().next().value, cluster = [first];
      left.delete(first);
      for (let i = 0; i < cluster.length; i++) {
        for (const e of [...left]) {
          const a = cluster[i].v, b = e.v;
          if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] > near) { cluster.push(e); left.delete(e); }
        }
      }
      if (cluster.length >= 3) out.push(cluster);
    }
  }
  return out;
}
// Join each train's members on the sky in order along their direction of travel, and label it.
function drawTrains(P, nowMs) {
  ctx.strokeStyle = C.lit; ctx.fillStyle = C.lit; ctx.font = `600 11px ${FONT_M}`; ctx.textAlign = "left";
  for (const members of trainClusters()) {
    const m = [0, 1, 2].map(j => members.reduce((s, e) => s + e.v1[j] - e.v[j], 0));   // average motion
    members.sort((a, b) => (a.v[0] * m[0] + a.v[1] * m[1] + a.v[2] * m[2]) - (b.v[0] * m[0] + b.v[1] * m[1] + b.v[2] * m[2]));
    ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
    ctx.beginPath(); members.forEach((e, i) => i ? ctx.lineTo(e.qx, e.qy) : ctx.moveTo(e.qx, e.qy)); ctx.stroke();
    ctx.globalAlpha = 1;
    const head = members[members.length - 1];
    ctx.fillText(`${tl("Starlink train", "Starlink-Kette")} · ${members.length}`, head.qx + 10, head.qy + 16);
  }
}
