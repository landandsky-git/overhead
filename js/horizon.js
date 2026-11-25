// Overhead: Your own horizon: the trees and rooftops that hide the low sky where you watch from.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// Recorded by pointing the crosshair along the skyline and turning slowly once around (the camera
// picture helps in the dark). It is kept per place, as 72 heights, one per 5° of direction (the
// `skyline` in astro.js). Passes that stay behind it are marked, and satellites behind it are dimmed.
const HZ = { on: false, heights: null, last: null, timer: 0, camera: false };
const skylineStoreKey = () => S.loc ? `skyline_${S.loc.lat.toFixed(2)},${S.loc.lon.toFixed(2)}` : null;
function loadSkyline() {
  const k = skylineStoreKey();
  skyline = k ? store.get(k, null) : null;
  skylineVer++;
  sendSkyline(); S.passesAt = 0;   // passes are worked out again with it
}

async function openHorizon() {
  if (!S.loc) { showHint(tl("Set your location first.", "Lege zuerst deinen Standort fest."), 4000); return; }
  if (S.mode !== "sensor" || !S.R) {
    showHint(tl("Recording your horizon needs the motion sensors. Tap the phone button on the right to follow your phone first.",
                "Zum Aufzeichnen des Horizonts braucht die App die Bewegungssensoren. Tippe zuerst rechts auf die Handy-Taste."), 7000);
    return;
  }
  HZ.on = true; HZ.heights = new Array(72).fill(null); HZ.last = null;
  $("hzBar").hidden = false; $("sheet").hidden = true; $("card").hidden = true;
  $("hzHelp").textContent = tl("Starting the camera…", "Kamera wird gestartet…");
  updateHzProgress();
  HZ.camera = await startCamera();
  if (!HZ.on) return;   // cancelled meanwhile
  $("hzHelp").textContent = tl("Point the crosshair at the tops of the trees and rooftops, then turn slowly all the way round, following them. Tap Save when you're back where you started.",
                               "Richte das Fadenkreuz auf die Oberkante von Bäumen und Dächern und dreh dich dann langsam einmal ganz herum, immer an ihr entlang. Tippe auf Speichern, wenn du wieder am Anfang bist.");
  HZ.timer = setInterval(sampleHorizon, 100);
}
// Where the crosshair points goes into the 5° step of that direction. Turning quickly skips steps,
// so the ones in between are filled in along the way.
function sampleHorizon() {
  if (!HZ.on || !S.R) return;
  const R = S.R, az = viewAz(R), el = Math.max(0, Math.min(60, Math.asin(Math.max(-1, Math.min(1, -R[8]))) * R2D));
  const bin = Math.round(az / 5) % 72, h = HZ.heights;
  if (HZ.last) {
    const d = ((bin - HZ.last.bin + 108) % 72) - 36;   // shortest way round, in steps
    if (Math.abs(d) <= 12) for (let k = 1; k < Math.abs(d); k++) {
      const b = (HZ.last.bin + Math.sign(d) * k + 72) % 72;
      h[b] = HZ.last.el + (el - HZ.last.el) * k / Math.abs(d);
    }
  }
  h[bin] = el; HZ.last = { bin, el };
  updateHzProgress();
}
function updateHzProgress() {
  const done = HZ.heights ? HZ.heights.filter(v => v != null).length : 0, pct = Math.round(done / 72 * 100);
  $("hzFill").style.width = pct + "%";
  $("hzPct").textContent = tl(`${pct}% of the way round`, `${pct} % der Runde`);
}
function saveHorizon() {
  const h = HZ.heights, known = [];
  h.forEach((v, i) => { if (v != null) known.push(i); });
  if (known.length < 18) { showHint(tl("Turn further round first: at least a quarter of the way.", "Dreh dich erst weiter herum, mindestens ein Viertel der Runde."), 5000); return; }
  // directions you didn't point at are filled in between their recorded neighbours
  const out = h.map((v, i) => {
    if (v != null) return Math.round(v * 10) / 10;
    let a = i, b = i, da = 0, db = 0;
    do { a = (a + 71) % 72; da++; } while (h[a] == null);
    do { b = (b + 1) % 72; db++; } while (h[b] == null);
    return Math.round((h[a] + (h[b] - h[a]) * da / (da + db)) * 10) / 10;
  });
  store.set(skylineStoreKey(), out);
  closeHorizon(); loadSkyline(); updateCard();
  showHint(tl("Your horizon is saved for this place. Passes behind trees and rooftops are now marked.", "Dein Horizont ist für diesen Ort gespeichert. Überflüge hinter Bäumen und Dächern werden jetzt markiert."), 6000);
}
function closeHorizon() {
  HZ.on = false; clearInterval(HZ.timer);
  if (!CAM.on && !ALIGN.on) stopCamera();
  HZ.camera = false;
  $("hzBar").hidden = true; $("sheet").hidden = false;
  sheetH(); updateCard();
}
function clearHorizon() {
  const k = skylineStoreKey(); if (!k) return;
  try { localStorage.removeItem(k); } catch {}
  loadSkyline(); renderHorizonSetting(); updateCard();
}
function renderHorizonSetting() {
  $("hzNote").textContent = skyline
    ? tl("Recorded for this place. Satellites behind your trees and rooftops are dimmed, and passes that stay behind them are marked.",
         "Für diesen Ort aufgezeichnet. Satelliten hinter deinen Bäumen und Dächern werden abgeblendet, und Überflüge, die dahinter bleiben, werden markiert.")
    : tl("Not recorded, so the app assumes open sky down to the horizon. Record it once where you usually watch from.",
         "Nicht aufgezeichnet, die App nimmt also freie Sicht bis zum Horizont an. Zeichne ihn einmal dort auf, wo du meistens beobachtest.");
  $("hzRecord").textContent = skyline ? tl("Record it again", "Neu aufzeichnen") : tl("Record my horizon", "Meinen Horizont aufzeichnen");
  $("hzClear").hidden = !skyline;
}

// The skyline on the sky: filled up from the true horizon, in 5° slices (simple to project even when
// part of it is behind you), with its top edge outlined. While recording, the part done so far.
function drawSkyline(R, f, th, P) {
  const h = HZ.on ? HZ.heights : skyline;
  if (!h) return;
  ctx.fillStyle = C.sky; ctx.globalAlpha = 0.82;
  for (let i = 0; i < 72 && !HZ.on; i++) {   // while recording, only the line (the camera shows the real skyline)
    const a = h[i], b = h[(i + 1) % 72];
    if (a == null || b == null) continue;
    const q = [P(enu(i * 5, a)), P(enu(i * 5 + 5, b)), P(enu(i * 5 + 5, -1)), P(enu(i * 5, -1))];
    if (q.some(p => !p.front)) continue;
    ctx.beginPath(); q.forEach((p, k) => k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.strokeStyle = HZ.on ? C.target : C.horizon; ctx.lineWidth = HZ.on ? 2 : 1.5;
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i <= 72; i++) {
    const v = h[i % 72], q = v == null ? null : P(enu(i * 5, v));
    if (!q || !q.front) { pen = false; continue; }
    if (pen) ctx.lineTo(q.x, q.y); else { ctx.moveTo(q.x, q.y); pen = true; }
  }
  ctx.stroke(); ctx.lineWidth = 1;
}

$("hzRecord").addEventListener("click", () => { $("settings").hidden = true; closeLayer($("settings")); openHorizon(); });
$("hzClear").addEventListener("click", clearHorizon);
$("hzCancel").addEventListener("click", closeHorizon);
$("hzSave").addEventListener("click", saveHorizon);
