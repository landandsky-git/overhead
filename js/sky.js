// Overhead: Drawing the sky.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// ---------- rendering ----------
const cv = $("sky"), ctx = cv.getContext("2d");
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
}
addEventListener("resize", resize);

function screenAngle() {
  const a = (screen.orientation && typeof screen.orientation.angle === "number") ? screen.orientation.angle : (window.orientation || 0);
  return a * D2R;
}
// Project a unit sky vector (east, north, up) to the screen.
function projectV(v, R, f, th) {
  const dx = R[0] * v[0] + R[3] * v[1] + R[6] * v[2];
  const dy = R[1] * v[0] + R[4] * v[1] + R[7] * v[2];
  const dz = R[2] * v[0] + R[5] * v[1] + R[8] * v[2];
  const sx = Math.cos(th) * dx - Math.sin(th) * dy;
  const sy = Math.sin(th) * dx + Math.cos(th) * dy;
  return { x: W / 2 + (sx / -dz) * f, y: H / 2 - (sy / -dz) * f, front: -dz > 0.05, sx, sy };
}
const project = (az, el, R, f, th) => projectV(enu(az, el), R, f, th);

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = {};
let FONT_D = "", FONT_M = "";
function loadColors() {
  for (const k of ["sky","ink","dim","lit","shadow","target","star","horizon","line","planet","moon"]) C[k] = css("--" + k);
  FONT_D = css("--font-display"); FONT_M = css("--font-data");
}

function polyline(pts, R, f, th) {
  ctx.beginPath();
  let pen = false;
  for (const p of pts) {
    const q = p.v ? projectV(p.v, R, f, th) : project(p.az, p.el, R, f, th);
    if (!q.front) { pen = false; continue; }
    if (pen) ctx.lineTo(q.x, q.y); else { ctx.moveTo(q.x, q.y); pen = true; }
  }
  ctx.stroke();
}

function compassName(az) { return ["N","NE","E","SE","S","SW","W","NW"][Math.round(az / 45) % 8]; }
function viewAz(R) { return ((Math.atan2(-R[2], -R[5]) * R2D) + 360) % 360; }

const GRID = [];
for (const alt of [30, 60]) { const pts = []; for (let a = 0; a <= 360; a += 5) pts.push({ v: enu(a, alt) }); GRID.push(pts); }
for (let a = 0; a < 360; a += 30) { const pts = []; for (let e = 0; e <= 90; e += 5) pts.push({ v: enu(a, e) }); GRID.push(pts); }
const HORIZON = []; for (let a = 0; a <= 360; a += 3) HORIZON.push({ v: enu(a, 0) });

// One size and brightness scale for stars and satellites, so you can compare them on screen.
const magRadius = m => Math.max(0.7, Math.min(5.5, 4.2 - 0.6 * m));
const magAlpha = m => Math.max(0.3, Math.min(1, 1.1 - 0.11 * m));
const MAG_STEPS = [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7];
const magStep = m => Math.max(0, Math.min(MAG_STEPS.length - 1, Math.floor(m + 2.5)));

// The Moon with its phase: lit fraction 0-1, litAngle = screen direction (radians) of the lit limb.
function drawMoon(x, y, r, lit, litAngle) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(litAngle);
  ctx.fillStyle = C.line; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  const rx = r * Math.abs(2 * lit - 1);
  ctx.fillStyle = C.moon; ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);   // the lit half facing the Sun
  if (lit >= 0.5) ctx.ellipse(0, 0, rx, r, 0, Math.PI / 2, Math.PI * 1.5, false);   // gibbous: terminator bulges out
  else ctx.ellipse(0, 0, rx, r, 0, Math.PI / 2, -Math.PI / 2, true);               // crescent: terminator cuts in
  ctx.fill(); ctx.restore();
}

// The followed pass: its path (gone part faint, coming part dashed), a dot each minute with the time,
// and where it rises and is highest.
function drawPassArc(R, f, th, P) {
  const arc = WATCH.arc, now = simNow();
  ctx.strokeStyle = C.target; ctx.lineWidth = 2;
  ctx.globalAlpha = 0.35; polyline(arc.filter(p => p.t <= now + 10e3), R, f, th);
  ctx.globalAlpha = 0.9; ctx.setLineDash([6, 5]); polyline(arc.filter(p => p.t >= now - 10e3), R, f, th); ctx.setLineDash([]);
  ctx.lineWidth = 1; ctx.globalAlpha = 1;
  ctx.font = `10px ${FONT_M}`; ctx.fillStyle = C.target; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  let lx = -1e9, ly = -1e9;
  for (let m = Math.ceil(arc[0].t / 60e3) * 60e3; m <= arc[arc.length - 1].t; m += 60e3) {
    const i = arc.findIndex(p => p.t >= m);
    if (i <= 0) continue;
    const a = arc[i - 1], b = arc[i], k = (m - a.t) / (b.t - a.t);
    const v = [0, 1, 2].map(j => a.v[j] + (b.v[j] - a.v[j]) * k);
    if (v[2] < 0) continue;
    const q = P(v);
    if (!q.front) continue;
    ctx.beginPath(); ctx.arc(q.x, q.y, 2.5, 0, 7); ctx.fill();
    if (Math.hypot(q.x - lx, q.y - ly) > 46) { ctx.fillText(fmtTime(m), q.x + 6, q.y); lx = q.x; ly = q.y; }
  }
  const rise = arc.find(p => p.el >= 0), top = arc.reduce((a, b) => b.el > a.el ? b : a);
  ctx.font = `600 11px ${FONT_M}`; ctx.textAlign = "center";
  if (rise) { const q = P(rise.v); if (q.front) ctx.fillText("rises here", q.x, q.y + 14); }
  { const q = P(top.v); if (q.front) ctx.fillText(`highest ${top.el.toFixed(0)}°`, q.x, q.y - 13); }
  ctx.textAlign = "left";
}

let prevLabels = new Set();
let tapX = new Float32Array(32768), tapY = new Float32Array(32768), tapI = new Int32Array(32768), tapN = 0, frameNo = 0;
const readoutEl = $("readout");

function draw() {
  requestAnimationFrame(draw);
  frameNo++;
  if (!W) resize();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // While aligning with the camera on, the sky is drawn over the live camera picture.
  if (ALIGN.camera) ctx.clearRect(0, 0, W, H); else { ctx.fillStyle = C.sky; ctx.fillRect(0, 0, W, H); }
  if (S.mode !== "sensor") S.R = rotFromView(S.view.az, S.view.el);
  const R = S.R; if (!R) return;
  const th = S.mode === "sensor" ? screenAngle() : 0;
  const f = (H / 2) / Math.tan((S.vfov / 2) * D2R);
  const P = v => projectV(v, R, f, th);

  // altitude rings, azimuth spokes, horizon
  ctx.lineWidth = 1; ctx.strokeStyle = C.line;
  for (const g of GRID) polyline(g, R, f, th);
  ctx.strokeStyle = C.horizon; ctx.lineWidth = 2; polyline(HORIZON, R, f, th); ctx.lineWidth = 1;
  ctx.font = `600 14px ${FONT_D}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let a = 0; a < 360; a += 45) {
    const q = project(a, 0, R, f, th); if (!q.front) continue;
    ctx.fillStyle = a % 90 === 0 ? C.ink : C.dim;
    ctx.fillText(compassName(a), q.x, q.y + 14);
  }
  ctx.font = `10px ${FONT_M}`; ctx.fillStyle = C.dim;
  for (const alt of [30, 60]) { const q = project(Math.round(viewAz(R) / 30) * 30 + 15, alt, R, f, th); if (q.front) ctx.fillText(alt + "°", q.x, q.y - 6); }
  { const q = project(0, 90, R, f, th); if (q.front) ctx.fillText("ZENITH", q.x, q.y - 8); }

  // constellation outlines and names (above the horizon only)
  ctx.strokeStyle = C.line; ctx.lineWidth = 1;
  for (const seg of sky.lines) {
    ctx.beginPath();
    let pen = false;
    for (const pt of seg) {
      const q = pt.el > -1 ? P(pt.v) : null;
      if (!q || !q.front) { pen = false; continue; }
      if (pen) ctx.lineTo(q.x, q.y); else { ctx.moveTo(q.x, q.y); pen = true; }
    }
    ctx.stroke();
  }
  ctx.font = `600 9px ${FONT_D}`; ctx.fillStyle = C.line; ctx.textAlign = "center";
  for (const n of sky.names) {
    if (n.rank > (S.vfov < 45 ? 3 : 2) || n.el < 3) continue;
    const q = P(n.v); if (q.front) ctx.fillText(n.name.toUpperCase(), q.x, q.y);
  }
  // stars: anything fainter than what your sky shows right now is drawn faintly
  const seeLimit = limitNow();
  const nameMag = Math.min(4, 1.3 + 2 * Math.log2(VFOV.normal / S.vfov));   // zoomed in: name fainter stars too
  ctx.font = `10px ${FONT_M}`; ctx.textAlign = "left";
  for (const s of sky.stars) {
    if (s.el < -1) continue;
    const q = P(s.v); if (!q.front) continue;
    ctx.fillStyle = C.star; ctx.globalAlpha = s.mag > seeLimit ? 0.22 : magAlpha(s.mag);
    ctx.beginPath(); ctx.arc(q.x, q.y, magRadius(s.mag), 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    if (s.mag < nameMag && s.name) { ctx.fillStyle = C.dim; ctx.fillText(s.name, q.x + 5, q.y + 8); }
  }

  // planets, always labelled: they are the brightest points in the sky and easy to mistake for satellites
  ctx.font = `600 11px ${FONT_M}`;
  for (const p of sky.planets) {
    if (p.el < -1) continue;
    const q = P(p.v); if (!q.front) continue;
    ctx.fillStyle = C.planet; ctx.shadowColor = C.planet; ctx.shadowBlur = p.mag < 0 ? 8 : 3;
    ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(2, magRadius(p.mag)), 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillText(p.name, q.x + 7, q.y + 9);
  }
  if (sky.moon && sky.moon.el > -1) {
    const q = P(sky.moon.v);
    if (q.front) {
      // direction of the Sun on screen, so the lit side faces the right way
      const m = sky.moon.v, sv = sky.sunV, d = m[0] * sv[0] + m[1] * sv[1] + m[2] * sv[2];
      const t = [sv[0] - d * m[0], sv[1] - d * m[1], sv[2] - d * m[2]], tn = Math.hypot(...t) || 1;
      const q2 = P([m[0] + 0.02 * t[0] / tn, m[1] + 0.02 * t[1] / tn, m[2] + 0.02 * t[2] / tn]);
      drawMoon(q.x, q.y, 9, sky.moon.lit, Math.atan2(q2.y - q.y, q2.x - q.x));
      ctx.fillStyle = C.moon; ctx.fillText(`Moon ${Math.round(sky.moon.lit * 100)}%`, q.x + 13, q.y + 12);
    }
  }
  ctx.font = `10px ${FONT_M}`;

  // satellite trails (selected satellite and bright sunlit ones)
  const tgtSat = S.targetId ? S.byId.get(S.targetId) : null;
  for (const [idx, pts] of paths) {
    const isT = tgtSat && tgtSat.idx === idx;
    ctx.strokeStyle = isT ? C.target : C.lit; ctx.globalAlpha = isT ? 0.6 : 0.25;
    ctx.setLineDash([3, 4]); polyline(pts.filter(p => p.future), R, f, th);
    ctx.setLineDash([]); polyline(pts.filter(p => !p.future), R, f, th);
  }
  ctx.globalAlpha = 1;
  if (WATCH.arc && WATCH.arc.length > 1) drawPassArc(R, f, th, P);
  if (trackBack && trackBack.sat === tgtSat) drawTrackBack(R, f, th, P);

  // satellites: sunlit ones sized and faded by estimated brightness, on the same scale as the stars.
  // Dots are batched into one path per magnitude step so thousands stay cheap to draw.
  const sh = new Path2D(), bins = MAG_STEPS.map(() => new Path2D()), litDrawn = [];
  const cx = W / 2, cy = H / 2, near = [];
  if (tapX.length < S.now.length) { tapX = new Float32Array(S.now.length); tapY = new Float32Array(S.now.length); tapI = new Int32Array(S.now.length); }
  tapN = 0;
  const nowMs = simNow();
  for (const e of S.now) {
    if (e.el < 0) continue;
    // Favourites show even when their group is switched off, but like everything else they follow
    // "only show satellites bright enough to see". The selected satellite always stays on screen;
    // if the filter would hide it, it's drawn as a hollow ring instead of a dot.
    const isT = tgtSat && e.sat === tgtSat;
    const seeable = !S.eyeOnly || (e.lit && e.mag <= seeLimit);
    if (!isT && (!(S.show[e.sat.cat] || S.favs.has(e.sat.id)) || !seeable)) continue;
    const q = P(vNow(e, nowMs));
    if (!q.front || q.x < -20 || q.x > W + 20 || q.y < -20 || q.y > H + 20) continue;
    e.faint = !seeable;
    if (e.faint) {
      ctx.strokeStyle = C.target; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q.x, q.y, 3, 0, 6.2832); ctx.stroke();
    } else if (e.lit) {
      const r = magRadius(e.mag);
      bins[magStep(e.mag)].moveTo(q.x + r, q.y); bins[magStep(e.mag)].arc(q.x, q.y, r, 0, 6.2832);
      litDrawn.push(e);
    } else {
      sh.moveTo(q.x + 1.3, q.y); sh.arc(q.x, q.y, 1.3, 0, 6.2832);
    }
    e.qx = q.x; e.qy = q.y; e.frame = frameNo;
    tapX[tapN] = q.x; tapY[tapN] = q.y; tapI[tapN] = e.sat.idx; tapN++;
    const d2 = (q.x - cx) ** 2 + (q.y - cy) ** 2;
    if (d2 < 110 * 110 || (d2 < 150 * 150 && prevLabels.has(e.sat.idx))) near.push([d2, e]);
  }
  ctx.fillStyle = C.shadow; ctx.globalAlpha = 0.5; ctx.fill(sh);
  ctx.fillStyle = C.lit; ctx.shadowColor = C.lit;
  for (let b = MAG_STEPS.length - 1; b >= 0; b--) {
    ctx.globalAlpha = magAlpha(MAG_STEPS[b]); ctx.shadowBlur = MAG_STEPS[b] <= 1 ? 10 : MAG_STEPS[b] <= 3 ? 4 : 0;
    ctx.fill(bins[b]);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  drawTrains(P, nowMs);

  // labels: bright sunlit satellites, plus whatever is closest to the crosshair.
  // Names shown last frame get first claim on space, so labels don't flicker as dots move.
  ctx.font = `11px ${FONT_M}`; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  const labeled = new Set();
  // Skip any label that would overlap another label or the direction readout under the crosshair.
  const boxes = [[cx - 75, cy + 14, 150, 26]];
  const label = (e, color, force) => {
    if (labeled.has(e.sat.idx)) return;
    const text = favName(e.sat) + (e.faint ? " (too faint)" : ""), w = ctx.measureText(text).width, b = [e.qx + 6, e.qy - 17, w + 2, 14];
    if (!force && boxes.some(o => b[0] < o[0] + o[2] && o[0] < b[0] + b[2] && b[1] < o[1] + o[3] && o[1] < b[1] + b[3])) return;
    boxes.push(b); labeled.add(e.sat.idx); ctx.fillStyle = color; ctx.fillText(text, e.qx + 7, e.qy - 6);
  };
  const tgt = tgtSat ? S.nowMap.get(tgtSat.idx) : null;
  if (tgt && tgt.el > 0 && tgt.frame === frameNo) {
    ctx.font = `600 12px ${FONT_M}`; label(tgt, C.target, true); ctx.font = `11px ${FONT_M}`;
  }
  litDrawn.sort((a, b) => a.mag - b.mag);
  near.sort((a, b) => a[0] - b[0]);
  const wanted = [];
  for (const e of S.now) if (e.frame === frameNo && S.favs.has(e.sat.id)) wanted.push([e, C.ink]);
  for (let k = 0; k < Math.min(30, litDrawn.length) && litDrawn[k].mag < 4; k++) wanted.push([litDrawn[k], C.ink]);
  for (let k = 0; k < Math.min(6, near.length); k++) wanted.push([near[k][1], C.dim]);
  for (const [e, color] of wanted) if (prevLabels.has(e.sat.idx)) label(e, color);
  for (const [e, color] of wanted) label(e, color);
  prevLabels = labeled;

  // selected satellite: ring, or an arrow pointing to it (before a followed pass: to where it will rise)
  const riseAhead = WATCH.arc && WATCH.arc.length && WATCH.sat === tgtSat && nowMs < WATCH.pass.start;
  const aimV = tgt && tgt.el > 0 ? vNow(tgt, nowMs) : riseAhead ? WATCH.arc[0].v : null;
  if (tgt && tgt.el > 0 && tgt.frame === frameNo) {
    ctx.strokeStyle = C.target; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(tgt.qx, tgt.qy, 12, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
  }
  if (aimV) {
    const q = P(aimV);
    const on = q.front && q.x > 20 && q.x < W - 20 && q.y > 60 && q.y < H - 120;
    if (!on) {
      let ang = Math.atan2(-q.sy, q.sx);
      if (Math.abs(q.sx) < 1e-3 && Math.abs(q.sy) < 1e-3) ang = -Math.PI / 2;
      const x = W / 2 + Math.cos(ang) * (W / 2 - 40), y = H / 2 + Math.sin(ang) * (H / 2 - 110);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.fillStyle = C.target; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // crosshair (highlighted while aligning on a star, with a centre dot for precise aiming)
  ctx.strokeStyle = ALIGN.on ? C.target : C.dim; ctx.lineWidth = ALIGN.on ? 1.5 : 1;
  ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7);
  ctx.moveTo(cx - 26, cy); ctx.lineTo(cx - 18, cy); ctx.moveTo(cx + 18, cy); ctx.lineTo(cx + 26, cy);
  if (ALIGN.on) { ctx.moveTo(cx, cy - 26); ctx.lineTo(cx, cy - 18); ctx.moveTo(cx, cy + 18); ctx.lineTo(cx, cy + 26); }
  ctx.stroke(); ctx.lineWidth = 1;
  if (ALIGN.on) { ctx.fillStyle = C.target; ctx.beginPath(); ctx.arc(cx, cy, 1.5, 0, 7); ctx.fill(); }
  const vaz = viewAz(R), vel = Math.asin(Math.max(-1, Math.min(1, -R[8]))) * R2D;
  const txt = `${compassName(vaz)} ${vaz.toFixed(0).padStart(3, "0")}° · ${vel >= 0 ? "+" : ""}${vel.toFixed(0)}°`;
  if (readoutEl.textContent !== txt) readoutEl.textContent = txt;
}
