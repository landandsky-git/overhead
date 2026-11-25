// Overhead: Phone motion sensors and location.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// ---------- orientation ----------
function rotFromEuler(a, b, g) {
  a *= D2R; b *= D2R; g *= D2R;
  const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
  return [
    cA * cG - sA * sB * sG, -sA * cB, cA * sG + sA * sB * cG,
    sA * cG + cA * sB * sG,  cA * cB, sA * sG - cA * sB * cG,
    -cB * sG,                sB,      cB * cG,
  ];
}
function rotFromView(az, el) {
  az *= D2R; el *= D2R;
  const f = [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
  const r = [Math.cos(az), -Math.sin(az), 0];
  const u = [-Math.sin(az) * Math.sin(el), -Math.cos(az) * Math.sin(el), Math.cos(el)];
  // columns: device x = right, device y = up, device z = -forward
  return [r[0], u[0], -f[0], r[1], u[1], -f[1], r[2], u[2], -f[2]];
}
function angDiff(a, b) { return ((a - b + 540) % 360) - 180; }

// Keep the attitude a proper rotation after blending (Gram-Schmidt on the columns).
function orthonormalize(R) {
  let x = [R[0], R[3], R[6]], y = [R[1], R[4], R[7]];
  const nx = Math.hypot(...x); x = x.map(v => v / nx);
  const d = x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  y = [y[0] - d * x[0], y[1] - d * x[1], y[2] - d * x[2]];
  const ny = Math.hypot(...y); y = y.map(v => v / ny);
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  R[0] = x[0]; R[3] = x[1]; R[6] = x[2]; R[1] = y[0]; R[4] = y[1]; R[7] = y[2]; R[2] = z[0]; R[5] = z[1]; R[8] = z[2];
}

// "One euro" smoothing: heavy while the phone is held still, light while it is being turned.
// How fast the phone turns is itself averaged over a fraction of a second, so a single noisy
// reading can't switch the smoothing off (which made the sky snap back and forth).
const FILTER = { minHz: 1.0, beta: 3, speedHz: 1.0 };
function lowpassAlpha(hz, dt) { const tau = 1 / (2 * Math.PI * hz); return 1 / (1 + tau / dt); }
function smoothR(next) {
  const now = performance.now();
  if (!S.R || !SENS.started) { S.R = next.slice(); SENS.prev = next.slice(); SENS.rate = [0, 0, 0]; SENS.t = now; SENS.started = true; return; }
  const dt = Math.max(0.005, Math.min(0.2, (now - SENS.t) / 1000));
  SENS.t = now;
  // turn rate (rad/s) between the last two raw readings, from the skew part of next * prev^T
  const P = SENS.prev, N = next, M = (i, j) => N[i * 3] * P[j * 3] + N[i * 3 + 1] * P[j * 3 + 1] + N[i * 3 + 2] * P[j * 3 + 2];
  const w = [(M(2, 1) - M(1, 2)) / 2 / dt, (M(0, 2) - M(2, 0)) / 2 / dt, (M(1, 0) - M(0, 1)) / 2 / dt];
  const a = lowpassAlpha(FILTER.speedHz, dt);
  for (let i = 0; i < 3; i++) SENS.rate[i] += (w[i] - SENS.rate[i]) * a;
  SENS.prev = next.slice();
  const k = lowpassAlpha(FILTER.minHz + FILTER.beta * Math.hypot(...SENS.rate), dt);
  const R = S.R;
  for (let i = 0; i < 9; i++) R[i] += (next[i] - R[i]) * k;
  orthonormalize(R);
}

// Sensor fusion. The gyroscope-based stream ("deviceorientation") is smooth but its zero heading is
// arbitrary; the compass-based one (Android "deviceorientationabsolute", iOS webkitCompassHeading)
// knows north but jitters. Draw from the smooth stream and use the compass only to slowly learn
// how far it is turned from north.
const SENS = { offset: null, rel: null, lastRel: 0, started: false };
// Slowly track the gap to north; one wild compass reading can only nudge it by a fraction of a degree.
// The first readings are averaged evenly so north settles within about a second.
function learnOffset(est, k) {
  SENS.n = (SENS.n || 0) + 1;
  if (SENS.offset == null) { SENS.offset = est; return; }
  const diff = angDiff(est, SENS.offset);
  SENS.offset += SENS.n < 60 ? diff / SENS.n : Math.max(-8, Math.min(8, diff)) * k;
}
// Heading (degrees clockwise from north) of whichever device axis lies flatter: the top edge or the camera.
function axisHeading(R, useTop) { return (useTop ? Math.atan2(R[1], R[4]) : Math.atan2(-R[2], -R[5])) * R2D; }

function applyAttitude(R, offset) {
  if (S.mode !== "sensor") return;   // dragging the sky: the phone's turns are ignored (north is still learned)
  const d = (offset + S.corr) * D2R, c = Math.cos(d), s = Math.sin(d);
  // turn the world clockwise by d about the vertical: east' = east*c + north*s, north' = -east*s + north*c
  S.lastSensor = Date.now();
  smoothR([
    c * R[0] + s * R[3], c * R[1] + s * R[4], c * R[2] + s * R[5],
    -s * R[0] + c * R[3], -s * R[1] + c * R[4], -s * R[2] + c * R[5],
    R[6], R[7], R[8],
  ]);
}

function onRelative(e) {
  if (e.alpha == null) return;
  S.anyEvent = true;
  if (e.absolute === true) return onAbsolute(e);   // Firefox: this stream is already north-based
  const R = rotFromEuler(e.alpha, e.beta, e.gamma);
  SENS.rel = R; SENS.lastRel = Date.now();
  // iOS: the compass heading is for the top edge and is trustworthy while the phone is fairly flat.
  if (typeof e.webkitCompassHeading === "number" && e.webkitCompassHeading >= 0 && Math.abs(e.beta) < 50 && Math.abs(e.gamma) < 50) {
    learnOffset(e.webkitCompassHeading - axisHeading(R, true), 0.05);
  }
  if (SENS.offset != null) applyAttitude(R, SENS.offset);
}

function onAbsolute(e) {
  if (e.alpha == null) return;
  S.anyEvent = true;
  const A = rotFromEuler(e.alpha, e.beta, e.gamma);
  if (SENS.rel && Date.now() - SENS.lastRel < 250) {
    const useTop = Math.hypot(SENS.rel[1], SENS.rel[4]) > Math.hypot(SENS.rel[2], SENS.rel[5]);
    learnOffset(axisHeading(A, useTop) - axisHeading(SENS.rel, useTop), 0.015);
  } else {
    applyAttitude(A, 0);   // no gyroscope stream on this phone: use the compass one directly
  }
}

async function startSensors() {
  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
    const p = await DeviceOrientationEvent.requestPermission();
    if (p !== "granted") throw new Error(tl("Motion access was denied. Allow motion sensors for this site in your browser settings, then try again.",
                                            "Zugriff auf die Bewegungssensoren verweigert. Erlaube sie für diese Seite in den Browser-Einstellungen und versuche es dann noch einmal."));
  }
  if (!SENS.listening) {
    window.addEventListener("deviceorientationabsolute", onAbsolute);
    window.addEventListener("deviceorientation", onRelative);
    SENS.listening = true;
  }
  try { await screen.orientation?.lock?.("portrait"); } catch {}   // works for the installed app on Android
  S.mode = "sensor";
  setTimeout(() => {
    if (S.anyEvent || S.mode !== "sensor") return;
    S.mode = "drag"; updateModeUI();
    showHint(tl("No motion sensors found. Drag the sky to look around.", "Keine Bewegungssensoren gefunden. Zieh den Himmel, um dich umzusehen."), 5000);
  }, 2500);
}

// The phone button on the right switches between following the phone and dragging the sky with a
// finger, at any time. Switching to dragging keeps the view where the phone pointed; switching back
// jumps to where it points now. On iPhones the first switch on asks for motion access.
async function setMotion(on) {
  if (on === (S.mode === "sensor")) return;
  if (on) {
    try { await startSensors(); }
    catch (e) { showHint(e.message, 6000); updateModeUI(); return; }
    SENS.started = false;
    showHint(tl("Following your phone. Point it at the sky.", "Folgt deinem Handy. Richte es auf den Himmel."), 4000);
  } else {
    if (S.R) { S.view.az = viewAz(S.R); S.view.el = Math.max(-10, Math.min(90, Math.asin(Math.max(-1, Math.min(1, -S.R[8]))) * R2D)); }
    if (CAM.on) await toggleCamera();   // the camera picture only lines up while following the phone
    if (ALIGN.on) closeAlign();
    S.mode = "drag";
    showHint(tl("Drag the sky with your finger to look around.", "Zieh den Himmel mit dem Finger, um dich umzusehen."), 4000);
  }
  updateModeUI();
}
function updateModeUI() {
  const on = S.mode === "sensor", b = $("motionBtn");
  b.setAttribute("aria-pressed", on);
  b.title = on ? tl("Following your phone: tap to drag the sky instead", "Folgt deinem Handy: tippen, um stattdessen den Himmel zu ziehen")
               : tl("Dragging the sky: tap to follow your phone", "Himmel ziehen: tippen, um deinem Handy zu folgen");
  $("camBtn").hidden = !on;   // the camera view follows the phone too
}
$("motionBtn").addEventListener("click", () => setMotion(S.mode !== "sensor"));

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error(tl("This browser can't share its location. Search for your town in Settings.", "Dieser Browser kann keinen Standort liefern. Suche deinen Ort in den Einstellungen.")));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4), h: p.coords.altitude || 0 }),
      err => reject(new Error(err.code === 1 ? tl("Location access was denied. Search for your town in Settings instead.", "Standortzugriff verweigert. Suche stattdessen deinen Ort in den Einstellungen.")
                                             : tl("Couldn't get your location. Search for your town in Settings.", "Dein Standort ließ sich nicht ermitteln. Suche deinen Ort in den Einstellungen."))),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  });
}
