// Overhead: NASA's detailed 3D models of the ISS and Hubble, loaded only when asked for.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// These need the three.js 3D library (lib/three, about 1.1 MB) and NASA's model files (models/,
// see models/CREDITS.md). Nothing is downloaded until the button is tapped; after that the phone
// keeps a copy, so they also work offline.
// Sizes are for the first download (the 3D library plus the model). NASA's ISS file also has a few
// leftover parts floating about 40 m above the station; `hide` removes them. `turn` lays the model
// flat (its file stands the station on end).
const DETAILED = {
  iss: { file: "models/iss.glb", mb: 1.6, hide: /^(bendedtru|pCylinder)/, turn: [0, 0, Math.PI / 2] },
  hubble: { file: "models/hubble.glb", mb: 2.8 },
};
const offerText = d => tl(`Show NASA's detailed model (${fmtN(d.mb, 1)} MB download)`, `Detailliertes NASA-Modell zeigen (${fmtN(d.mb, 1)} MB Download)`, `Показати детальну модель NASA (завантаження ${fmtN(d.mb, 1)} МБ)`);
const detail = { key: null, renderer: null, controls: null, scene: null, raf: 0, busy: false };
const libUrl = path => new URL(path, document.baseURI).href;

// Show or hide the button under the simple model, for the model shown in the details panel.
function offerDetailedModel(key) {
  closeDetailedModel();
  const d = DETAILED[key], btn = $("modelDetailBtn");
  detail.key = d ? key : null;
  btn.hidden = !d;
  if (d) btn.textContent = offerText(d);
}

async function openDetailedModel() {
  if (!detail.key || detail.busy) return;
  detail.busy = true;
  const btn = $("modelDetailBtn"), cv = $("modelGL"), key = detail.key;
  btn.textContent = tl("Loading the detailed model…", "Detailliertes Modell wird geladen…", "Завантаження детальної моделі…");
  try {
    const THREE = await import("three");
    const [{ GLTFLoader }, { DRACOLoader }, { OrbitControls }] = await Promise.all([
      import(libUrl("lib/three/loaders/GLTFLoader.js")), import(libUrl("lib/three/loaders/DRACOLoader.js")), import(libUrl("lib/three/controls/OrbitControls.js"))]);
    const draco = new DRACOLoader().setDecoderPath(libUrl("lib/three/draco/")).setDecoderConfig({ type: "wasm" });
    let gltf;
    try { gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(libUrl(DETAILED[key].file)); }
    finally { draco.dispose(); }   // stops the decoder's background workers
    if (detail.key !== key || S.detailsId == null) return;   // closed while loading

    const scene = new THREE.Scene(), model = gltf.scene, hide = DETAILED[key].hide, junk = [];
    if (hide) { model.traverse(o => { if (o.isMesh && hide.test(o.name)) junk.push(o); }); junk.forEach(o => o.removeFromParent()); }
    if (DETAILED[key].turn) model.rotation.set(...DETAILED[key].turn);
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    model.position.sub(mid);
    scene.add(model, new THREE.AmbientLight(0xffffff, 0.7), new THREE.HemisphereLight(0xdde6ff, 0x202430, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(5, 4, 3); scene.add(sun);
    const camera = new THREE.PerspectiveCamera(40, 1, size.length() / 100, size.length() * 20);
    camera.position.set(0.6, 0.45, 1).normalize().multiplyScalar(size.length() * 1.25);
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const controls = new OrbitControls(camera, cv);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;   // then it only turns when dragged
    Object.assign(controls, { enableDamping: true, autoRotate: !still, autoRotateSpeed: 1.2, enablePan: false });
    controls.addEventListener("start", () => { controls.autoRotate = false; });
    Object.assign(detail, { renderer, controls, scene });

    $("model3d").hidden = true; cv.hidden = false;
    window.Model3D?.stop();
    const loop = () => {
      detail.raf = requestAnimationFrame(loop);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
      controls.update(); renderer.render(scene, camera);
    };
    loop();
    btn.textContent = tl("Show the simple model", "Einfaches Modell zeigen", "Показати просту модель");
    $("modelNote").textContent = tl("3D model: NASA. Drag to turn it, pinch to zoom.", "3D-Modell: NASA. Zum Drehen ziehen, mit zwei Fingern zoomen.", "3D-модель: NASA. Тягни, щоб обертати, зводь або розводь пальці, щоб масштабувати.");
  } catch (e) {
    btn.textContent = tl("Couldn't load the detailed model. Check your connection and try again.", "Das detaillierte Modell ließ sich nicht laden. Prüfe deine Verbindung und versuche es erneut.", "Не вдалося завантажити детальну модель. Перевір з’єднання й спробуй ще раз.");
  } finally { detail.busy = false; }
}

function closeDetailedModel() {
  cancelAnimationFrame(detail.raf); detail.raf = 0;
  if (detail.controls) detail.controls.dispose();
  if (detail.scene) detail.scene.traverse(o => {   // free the graphics memory the model used
    if (o.geometry) o.geometry.dispose();
    for (const m of [].concat(o.material || [])) { for (const v of Object.values(m)) if (v && v.isTexture) v.dispose(); m.dispose(); }
  });
  if (detail.renderer) detail.renderer.dispose();
  detail.renderer = detail.controls = detail.scene = null;
  $("modelGL").hidden = true; $("model3d").hidden = false;
}

$("modelDetailBtn").addEventListener("click", () => {
  if (detail.renderer) {   // back to the simple model
    closeDetailedModel();
    const sat = S.byId.get(S.detailsId);
    if (sat) { const o = orbitInfo(sat), m = window.Model3D?.open($("model3d"), { name: sat.nameU, orbit: o && o.short }); if (m) $("modelNote").textContent = simpleModelNote(m); }
    $("modelDetailBtn").textContent = offerText(DETAILED[detail.key]);
  } else openDetailedModel();
});
