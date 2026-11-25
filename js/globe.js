// Overhead: The 3D globe: zoom out from your patch of sky to the whole Earth and every satellite.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// three.js (the same library as NASA's models, loaded only when needed) draws the Earth with its
// coastlines (Natural Earth, public domain) and its day and night sides, the stars behind it, and
// every satellite where it is right now: sunlit ones gold and the ones in Earth's shadow blue, as on
// the sky. Starlink's shells, the geostationary ring and the debris clouds show up on their own.
// The background worker works out the positions; time can run 60 or 600 times faster.
const GLOBE = { on: false, three: null, renderer: null, scene: null, camera: null, controls: null, earth: null, points: null,
                marker: null, orbit: null, raf: 0, timer: 0, busy: false, sent: 0, job: 0, speed: 1, t0: 0, real0: 0, picked: null, coast: null, down: null };
const globeNow = () => GLOBE.t0 + (Date.now() - GLOBE.real0) * GLOBE.speed;
// Earth-centred space coordinates (x towards the March equinox, z towards the north pole) as three.js
// coordinates (y up).
const toThree = (x, y, z) => [x, z, -y];
// A place on Earth (latitude, longitude in degrees) in Earth-fixed coordinates, radius r.
const earthPoint = (lat, lon, r) => toThree(r * Math.cos(lat * D2R) * Math.cos(lon * D2R), r * Math.cos(lat * D2R) * Math.sin(lon * D2R), r * Math.sin(lat * D2R));

async function openGlobe() {
  if (GLOBE.on) return;
  Object.assign(GLOBE, { on: true, speed: 1, t0: simNow(), real0: Date.now(), picked: null, busy: false });
  $("globe").hidden = false;
  openLayer($("globe"), closeGlobe, $("globeBack"));
  renderGlobeInfo(); renderGlobeSpeed();
  $("globeNote").textContent = tl("Loading the globe…", "Globus wird geladen…", "Завантаження глобуса…");
  try {
    const THREE = GLOBE.three = await import("three");
    const { OrbitControls } = await import(libUrl("lib/three/controls/OrbitControls.js"));
    if (!GLOBE.coast) GLOBE.coast = await (await fetch("models/coastline.json")).json();
    if (!GLOBE.on) return;   // closed while loading
    buildGlobe(THREE, OrbitControls);
    $("globeNote").textContent = tl("Drag to turn it, pinch to zoom, tap a dot to see which satellite it is.", "Zum Drehen ziehen, mit zwei Fingern zoomen, auf einen Punkt tippen, um den Satelliten zu sehen.", "Тягни, щоб обертати, зводь або розводь пальці, щоб масштабувати, і торкнися точки, щоб побачити, що це за супутник.");
    requestGlobePositions();
    GLOBE.timer = setInterval(requestGlobePositions, 200);
  } catch {
    $("globeNote").textContent = tl("Couldn't load the globe. Check your connection and try again.", "Der Globus ließ sich nicht laden. Prüfe deine Verbindung und versuche es noch einmal.", "Не вдалося завантажити глобус. Перевір з’єднання й спробуй ще раз.");
  }
}

function buildGlobe(THREE, OrbitControls) {
  const cv = $("globeGL"), color = name => new THREE.Color(css(name));
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene(); scene.background = color("--sky");
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 300);

  // the Earth turns inside this group (by the sidereal angle), the satellites stay in space
  const earth = new THREE.Group(); scene.add(earth);
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 72, 48), new THREE.MeshPhongMaterial({ color: 0x18294a, emissive: 0x060b16, shininess: 6 })));
  const seg = [];
  for (const line of GLOBE.coast.lines) for (let k = 0; k + 3 < line.length; k += 2) seg.push(...earthPoint(line[k + 1], line[k], 1.002), ...earthPoint(line[k + 3], line[k + 2], 1.002));
  const grid = [];
  for (let lat = -60; lat <= 60; lat += 30) for (let lon = 0; lon < 360; lon += 5) grid.push(...earthPoint(lat, lon, 1.001), ...earthPoint(lat, lon + 5, 1.001));
  for (let lon = 0; lon < 360; lon += 30) for (let lat = -85; lat < 85; lat += 5) grid.push(...earthPoint(lat, lon, 1.001), ...earthPoint(lat + 5, lon, 1.001));
  const lines = (pts, c, opacity) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity })); };
  earth.add(lines(grid, color("--line"), 0.7), lines(seg, color("--dim"), 0.95));
  if (S.loc) {   // you
    const you = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), new THREE.MeshBasicMaterial({ color: color("--target") }));
    you.position.set(...earthPoint(S.loc.lat, S.loc.lon, 1.005)); earth.add(you);
  }

  // the stars, far away
  const stars = [];
  for (const s of CATALOG.stars) stars.push(...toThree(60 * Math.cos(s.dec) * Math.cos(s.ra), 60 * Math.cos(s.dec) * Math.sin(s.ra), 60 * Math.sin(s.dec)));
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(stars, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: color("--star"), size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7 })));

  // sunlight from the Sun's direction, so the night side is dark
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); scene.add(sun, new THREE.AmbientLight(0xffffff, 0.35));

  // every satellite as a dot; the positions arrive from the worker
  const n = S.sats.length, g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  const points = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
  points.frustumCulled = false; scene.add(points);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshBasicMaterial({ color: color("--target") }));
  marker.visible = false; scene.add(marker);

  const controls = new OrbitControls(camera, cv);
  Object.assign(controls, { enableDamping: true, enablePan: false, minDistance: 1.25, maxDistance: 16, rotateSpeed: 0.6, zoomSpeed: 0.8 });
  Object.assign(GLOBE, { renderer, scene, camera, controls, earth, points, marker, sun });

  // start above where you are
  const t = globeNow(), th = satellite.gstime(new Date(t));
  earth.rotation.y = th;
  const here = S.loc ? new THREE.Vector3(...earthPoint(S.loc.lat, S.loc.lon, 3.4)).applyAxisAngle(new THREE.Vector3(0, 1, 0), th) : new THREE.Vector3(0, 1.2, 3.2);
  camera.position.copy(here); controls.update();
  placeSun(t);

  // tap a dot: the nearest satellite to the tap that isn't hidden behind the Earth
  cv.addEventListener("pointerdown", e => { GLOBE.down = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener("pointerup", e => {
    const d = GLOBE.down; GLOBE.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
    const r = cv.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.params.Points.threshold = 0.025 * camera.position.length();
    ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
    const hitEarth = ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), 1), new THREE.Vector3()), earthDist = hitEarth ? hitEarth.distanceTo(ray.ray.origin) : Infinity;
    const hits = ray.intersectObject(points).filter(h => h.distance < earthDist && S.sats[h.index] && shownOnGlobe(S.sats[h.index]));
    hits.sort((a, b) => a.distanceToRay - b.distanceToRay);
    pickOnGlobe(hits.length ? S.sats[hits[0].index] : null);
  });

  const loop = () => {
    GLOBE.raf = requestAnimationFrame(loop);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    controls.update(); renderer.render(scene, camera);
  };
  loop();
}
const shownOnGlobe = sat => S.show[sat.cat] || S.favs.has(sat.id) || sat.id === (GLOBE.picked && GLOBE.picked.id);
function placeSun(t) {
  const v = sunPos(new Date(t)).v;
  GLOBE.sun.position.set(...toThree(v.x * 10, v.y * 10, v.z * 10));
}

function requestGlobePositions() {
  if (!GLOBE.on || (GLOBE.busy && Date.now() - GLOBE.sent < 2000)) return;
  GLOBE.busy = true; GLOBE.sent = Date.now();
  worker.postMessage({ type: "eci", t: globeNow(), job: ++GLOBE.job });
}
// New positions from the worker (positions.js passes them on).
function applyGlobePositions(m) {
  GLOBE.busy = false;
  if (!GLOBE.on || !GLOBE.points || m.job !== GLOBE.job) return;
  const pos = GLOBE.points.geometry.attributes.position, col = GLOBE.points.geometry.attributes.color, P = pos.array, Cc = col.array;
  const lit = new GLOBE.three.Color(css("--lit")), dark = new GLOBE.three.Color(css("--shadow"));
  const n = Math.min(S.sats.length, m.lit.length);
  for (let i = 0; i < n; i++) {
    const shown = shownOnGlobe(S.sats[i]), x = m.xyz[i * 3], y = m.xyz[i * 3 + 1], z = m.xyz[i * 3 + 2];
    P[i * 3] = shown ? x : 0; P[i * 3 + 1] = shown ? z : 0; P[i * 3 + 2] = shown ? -y : 0;   // hidden ones wait inside the Earth
    const c = m.lit[i] ? lit : dark;
    Cc[i * 3] = c.r; Cc[i * 3 + 1] = c.g; Cc[i * 3 + 2] = c.b;
  }
  pos.needsUpdate = true; col.needsUpdate = true;
  GLOBE.earth.rotation.y = satellite.gstime(new Date(m.t));
  placeSun(m.t);
  if (GLOBE.picked) {
    const i = GLOBE.picked.idx;
    GLOBE.marker.position.set(m.xyz[i * 3], m.xyz[i * 3 + 2], -m.xyz[i * 3 + 1]);
    GLOBE.pickedLit = !!m.lit[i];
  }
  $("globeTime").textContent = `${dayWord(m.t)} ${fmtTime(m.t)}${GLOBE.speed > 1 ? ` · ×${GLOBE.speed}` : ""}`;
  renderGlobeInfo();
}

// The tapped satellite: highlighted, with one full orbit drawn, and its name and height below.
function pickOnGlobe(sat) {
  GLOBE.picked = sat;
  GLOBE.marker.visible = !!sat;
  if (GLOBE.orbit) { GLOBE.scene.remove(GLOBE.orbit); GLOBE.orbit.geometry.dispose(); GLOBE.orbit.material.dispose(); GLOBE.orbit = null; }
  const r = sat && rec(sat), o = sat && orbitInfo(sat);
  if (r && o) {
    const THREE = GLOBE.three, pts = [], t0 = globeNow();
    for (let k = 0; k <= 180; k++) {
      const pv = satellite.propagate(r, new Date(t0 + o.period * 60e3 * k / 180));
      if (pv && pv.position) pts.push(...toThree(pv.position.x / 6371, pv.position.y / 6371, pv.position.z / 6371));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    GLOBE.orbit = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(css("--target")), transparent: true, opacity: 0.7 }));
    GLOBE.scene.add(GLOBE.orbit);
  }
  requestGlobePositions(); renderGlobeInfo();
}
function renderGlobeInfo() {
  const sat = GLOBE.picked, box = $("globeInfo");
  if (!sat) { box.innerHTML = `<span class="small">${tl(`${fmtN(S.sats.length)} satellites. Gold: sunlit · blue: in Earth's shadow · green: you`, `${fmtN(S.sats.length)} Satelliten. Gold: angestrahlt · Blau: im Erdschatten · Grün: du`, `${fmtN(S.sats.length)} ${ukPlural(S.sats.length, "супутник", "супутники", "супутників")}. Золоті: освітлені Сонцем · сині: у тіні Землі · зелена: ти`)}</span>`; return; }
  const m = GLOBE.marker.position, km = (Math.hypot(m.x, m.y, m.z) - 1) * 6371;
  box.innerHTML = `<div class="gi-name">${esc(sat.name)}</div>
    <div class="small">${fmtN(Math.max(0, km))} ${tl("km up", "km hoch", "км над Землею")} · ${GLOBE.pickedLit ? tl("sunlit", "angestrahlt", "освітлений Сонцем") : tl("in Earth's shadow", "im Erdschatten", "у тіні Землі")} · ${esc(CAT_LABEL[sat.cat])}</div>
    <div class="gi-acts"><button class="linkbtn" id="globeSky">${tl("Show on the sky ›", "Am Himmel zeigen ›", "Показати на небі ›")}</button><button class="linkbtn" id="globeDet">${tl("Details ›", "Details ›", "Докладніше ›")}</button></div>`;
}
function renderGlobeSpeed() {
  for (const b of document.querySelectorAll("#globeSpeed button")) b.setAttribute("aria-pressed", +b.dataset.s === GLOBE.speed);
}
function closeGlobe() {
  GLOBE.on = false; cancelAnimationFrame(GLOBE.raf); clearInterval(GLOBE.timer);
  if (GLOBE.controls) GLOBE.controls.dispose();
  if (GLOBE.scene) GLOBE.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  if (GLOBE.renderer) GLOBE.renderer.dispose();
  Object.assign(GLOBE, { renderer: null, scene: null, camera: null, controls: null, earth: null, points: null, marker: null, orbit: null, picked: null });
  $("globe").hidden = true; closeLayer($("globe"));
  tickBusy = false; requestTick();   // the sky picks up again
}

$("globeBtn").addEventListener("click", openGlobe);
$("globeBack").addEventListener("click", closeGlobe);
$("globeSpeed").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  GLOBE.t0 = +b.dataset.s === 1 ? simNow() : globeNow(); GLOBE.real0 = Date.now(); GLOBE.speed = +b.dataset.s;
  renderGlobeSpeed(); requestGlobePositions();
});
$("globeInfo").addEventListener("click", e => {
  const sat = GLOBE.picked; if (!sat) return;
  if (e.target.closest("#globeSky")) { closeGlobe(); setTarget(sat.id); }
  else if (e.target.closest("#globeDet")) openDetails(sat.id);
});
