// A small 3D viewer for the satellite details panel: simplified models built from boxes, cylinders and
// panels, drawn on a 2D canvas (flat shading, back faces hidden, far faces first). Drag to turn the
// model; it spins slowly on its own when left alone. Sizes are in metres.
// Real models (NASA publishes a few) need a full 3D library and megabytes of download, so every kind
// of satellite gets a simplified shape here, and NASA's ISS and Hubble models are offered on request
// (js/model-detail.js).
(() => {
  "use strict";
  const COLORS = {
    gold: [212, 168, 76], white: [222, 224, 230], grey: [128, 134, 146], dark: [78, 84, 98],
    solar: [52, 82, 160], silver: [186, 192, 204], nozzle: [74, 72, 76], radiator: [236, 238, 242],
    orange: [196, 112, 48],
  };

  // ---- building blocks: each returns faces {p: [[x,y,z]...], c: [r,g,b], solar?: true} ----
  function box([x, y, z], [sx, sy, sz], c, solar) {
    const a = sx / 2, b = sy / 2, d = sz / 2;
    const v = [[x - a, y - b, z - d], [x + a, y - b, z - d], [x + a, y + b, z - d], [x - a, y + b, z - d],
               [x - a, y - b, z + d], [x + a, y - b, z + d], [x + a, y + b, z + d], [x - a, y + b, z + d]];
    // corner order chosen so every face winds anticlockwise seen from outside (its normal points out)
    return [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [0, 1, 5, 4], [3, 7, 6, 2]]
      .map(f => ({ p: f.map(i => v[i]), c, solar }));
  }
  // Solar panel: a thin box; its two broad faces get the cell grid.
  const panel = (center, size, c = COLORS.solar) => box(center, size, c, true);
  // Cylinder (or cone when r1 != r2) along an axis, centred at c.
  function cylinder(c, axis, r1, len, cBody, r2 = r1, n = 16, caps = true) {
    const turn = axis === "x" ? ([x, y, z]) => [y, -x, z] : axis === "z" ? ([x, y, z]) => [x, -z, y] : p => p;
    const at = (r, a, h) => { const q = turn([r * Math.cos(a), h, r * Math.sin(a)]); return [q[0] + c[0], q[1] + c[1], q[2] + c[2]]; };
    const faces = [], h = len / 2;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * 2 * Math.PI, a1 = (i + 1) / n * 2 * Math.PI;
      faces.push({ p: [at(r1, a0, -h), at(r2, a0, h), at(r2, a1, h), at(r1, a1, -h)], c: cBody });
    }
    if (caps) {
      const ring = (r, hh) => Array.from({ length: n }, (_, i) => at(r, i / n * 2 * Math.PI, hh));
      if (r1 > 0) faces.push({ p: ring(r1, -h), c: cBody });
      if (r2 > 0) faces.push({ p: ring(r2, h).reverse(), c: cBody });
    }
    return faces;
  }
  const join = (...parts) => parts.flat();

  // Two solar wings either side of a body along x, each `len` long, `wid` wide, starting `gap` out.
  const wings = (len, wid, gap, y = 0, thick = 0.06) => join(
    panel([gap + len / 2, y, 0], [len, thick, wid]), panel([-gap - len / 2, y, 0], [len, thick, wid]),
    box([gap / 2, y, 0], [gap, 0.08, 0.08], COLORS.grey), box([-gap / 2, y, 0], [gap, 0.08, 0.08], COLORS.grey));
  // A dish antenna facing +z: a shallow cone.
  const dish = (c, r) => cylinder(c, "z", r, r * 0.35, COLORS.white, r * 0.15, 14);

  // ---- the models ----
  const MODELS = {
    cube: { title: tl("Placeholder", "Platzhalter", "Умовна модель"), size: tl("No model for this type yet", "Noch kein Modell für diese Art", "Для цього типу ще немає моделі"), build: () => box([0, 0, 0], [1, 1, 1], COLORS.gold) },
    iss: {
      title: tl("International Space Station", "Internationale Raumstation", "Міжнародна космічна станція"),
      size: tl("About 109 m across its main truss, 73 m long", "Etwa 109 m breit über die Hauptstruktur, 73 m lang", "Близько 109 м завширшки по головній фермі, 73 м завдовжки"),
      build: () => {
        const parts = [box([0, 0, 0], [100, 1.6, 1.6], COLORS.grey)];
        for (const x of [-46, -32, 32, 46]) for (const z of [-18.5, 18.5]) parts.push(panel([x, 0, z], [11.6, 0.1, 35]));
        for (const x of [-14, 14]) parts.push(box([x, -2.5, 0], [3, 0.15, 13], COLORS.radiator));
        parts.push(cylinder([0, -3.6, 0], "z", 2.1, 52, COLORS.white));      // modules in a line under the truss
        parts.push(cylinder([0, -3.6, -6], "x", 2.1, 16, COLORS.white));     // labs crossing them
        parts.push(cylinder([0, -3.6, 18], "x", 1.6, 10, COLORS.white));
        return join(...parts);
      },
    },
    css: {
      title: tl("Tiangong space station", "Raumstation Tiangong", "Космічна станція «Тяньгун»"),
      size: tl("About 55 m wide with solar arrays; modules about 17 m long", "Etwa 55 m breit mit Solarflächen; Module etwa 17 m lang", "Близько 55 м завширшки із сонячними панелями; модулі близько 17 м завдовжки"),
      build: () => join(
        cylinder([0, 0, 0], "z", 2.1, 16.6, COLORS.white),
        cylinder([9, 0, 6], "x", 2.1, 17.9, COLORS.white), cylinder([-9, 0, 6], "x", 2.1, 17.9, COLORS.white),
        panel([21, 0, 6], [6, 0.08, 28]), panel([-21, 0, 6], [6, 0.08, 28]),
        panel([0, 0, -4], [24, 0.06, 3.5])),
    },
    hubble: {
      title: tl("Hubble Space Telescope", "Hubble-Weltraumteleskop", "Космічний телескоп «Габбл»"),
      size: tl("13.2 m long, 4.2 m across", "13,2 m lang, 4,2 m Durchmesser", "13,2 м завдовжки, 4,2 м у діаметрі"),
      build: () => join(
        cylinder([0, 0, 0], "x", 2.1, 13.2, COLORS.silver, 2.1, 20),
        cylinder([7.4, 0, 0], "x", 2.2, 1.6, COLORS.dark, 2.2, 20),
        panel([-1, 0, 4.6], [2.6, 0.05, 7.1]), panel([-1, 0, -4.6], [2.6, 0.05, 7.1]),
        dish([-2, 2.8, 0], 0.7)),
    },
    starlinkOne: {
      title: tl("Starlink (version 1)", "Starlink (Version 1)", "Starlink (версія 1)"),
      size: tl("Body about 2.8 × 1.4 m, one solar array about 8 m long", "Körper etwa 2,8 × 1,4 m, eine Solarfläche etwa 8 m lang", "Корпус близько 2,8 × 1,4 м, одна сонячна панель близько 8 м завдовжки"),
      build: () => join(box([0, 0, 0], [2.8, 0.2, 1.4], COLORS.dark), box([0, 0.35, 0], [0.12, 0.5, 0.12], COLORS.grey), panel([4.6, 0.6, 0], [8.1, 0.05, 2.8])),
    },
    starlinkTwo: {
      title: "Starlink V2 Mini",
      size: tl("Body about 4.1 × 2.7 m, about 30 m across with both solar arrays", "Körper etwa 4,1 × 2,7 m, mit beiden Solarflächen etwa 30 m breit", "Корпус близько 4,1 × 2,7 м, з обома сонячними панелями близько 30 м завширшки"),
      build: () => join(box([0, 0, 0], [4.1, 0.3, 2.7], COLORS.dark), wings(12.8, 4.1, 1.2, 0.5)),
    },
    bluebird: {
      title: "AST SpaceMobile BlueBird",
      size: tl("Antenna array about 8 × 8 m, larger on the newest ones", "Antennenfeld etwa 8 × 8 m, bei den neuesten größer", "Антенна решітка близько 8 × 8 м, у найновіших більша"),
      build: () => join(panel([0, 0, 0], [8, 0.12, 8], COLORS.dark), box([0, -0.7, 0], [1.2, 1.2, 1.2], COLORS.gold)),
    },
    cubesat: {
      title: tl("CubeSat (small satellite)", "CubeSat (Kleinsatellit)", "CubeSat (малий супутник)"),
      size: tl("About 10 × 10 × 34 cm, the size of a loaf of bread", "Etwa 10 × 10 × 34 cm, so groß wie ein Brotlaib", "Близько 10 × 10 × 34 см, завбільшки з буханку хліба"),
      build: () => join(box([0, 0, 0], [0.1, 0.34, 0.1], COLORS.silver), panel([0.11, 0, 0], [0.12, 0.34, 0.01]), panel([-0.11, 0, 0], [0.12, 0.34, 0.01])),
    },
    rocket: {
      title: tl("Rocket stage", "Raketenstufe", "Ступінь ракети"),
      size: tl("Typically 6–12 m long and 2.5–4 m across", "Meist 6–12 m lang und 2,5–4 m Durchmesser", "Зазвичай 6–12 м завдовжки і 2,5–4 м у діаметрі"),
      build: () => join(cylinder([0, 0, 0], "x", 1.6, 9, COLORS.white, 1.6, 18), cylinder([-5.3, 0, 0], "x", 1.1, 1.6, COLORS.nozzle, 0.5, 14),
                        box([4.6, 0, 0], [0.3, 3.0, 0.3], COLORS.grey)),
    },
    debris: {
      title: tl("Debris", "Trümmerteil", "Уламок"),
      size: tl("Fragments, usually under a metre", "Bruchstücke, meist unter einem Meter", "Уламки, зазвичай менше метра"),
      build: () => {
        const v = [[0, 0.5, 0], [0.45, -0.2, 0.2], [-0.35, -0.25, 0.3], [0.05, -0.15, -0.45]];
        return [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]].map(f => ({ p: f.map(i => v[i]), c: COLORS.grey }));
      },
    },
    geo: {
      title: tl("Communications satellite (geostationary)", "Kommunikationssatellit (geostationär)", "Супутник зв’язку (геостаціонарний)"),
      size: tl("Body about 3 × 4 m, 30–40 m across with solar arrays", "Körper etwa 3 × 4 m, mit Solarflächen 30–40 m breit", "Корпус близько 3 × 4 м, із сонячними панелями 30–40 м завширшки"),
      build: () => join(box([0, 0, 0], [2.6, 3.6, 2.6], COLORS.gold), wings(13, 2.6, 1.6), dish([0, 0.6, 1.9], 1.2), dish([0, -0.9, 1.9], 0.8)),
    },
    gnss: {
      title: tl("Navigation satellite", "Navigationssatellit", "Навігаційний супутник"),
      size: tl("Body about 2 × 2 m, about 18 m across with solar arrays", "Körper etwa 2 × 2 m, mit Solarflächen etwa 18 m breit", "Корпус близько 2 × 2 м, із сонячними панелями близько 18 м завширшки"),
      build: () => join(box([0, 0, 0], [1.8, 2.2, 1.8], COLORS.gold), wings(6.5, 2, 1.2), box([0, 0, 1.05], [1.2, 1.2, 0.3], COLORS.white)),
    },
    weather: {
      title: tl("Weather or Earth-observation satellite", "Wetter- oder Erdbeobachtungssatellit", "Метеорологічний супутник або супутник спостереження Землі"),
      size: tl("Body about 4 m long, one large solar array", "Körper etwa 4 m lang, eine große Solarfläche", "Корпус близько 4 м завдовжки, одна велика сонячна панель"),
      build: () => join(box([0, 0, 0], [4.2, 1.6, 1.6], COLORS.gold), panel([0, 0, 4.6], [6, 0.05, 6]), box([0, 0, 1.3], [0.1, 0.1, 1], COLORS.grey),
                        box([1.6, -1, 0], [0.8, 0.4, 0.8], COLORS.white)),
    },
    generic: {
      title: tl("Satellite", "Satellit", "Супутник"),
      size: tl("Typical small satellite: body 1–2 m, a few metres across with solar arrays", "Typischer kleiner Satellit: Körper 1–2 m, mit Solarflächen einige Meter breit", "Типовий невеликий супутник: корпус 1–2 м, із сонячними панелями кілька метрів завширшки"),
      build: () => join(box([0, 0, 0], [1.4, 1.4, 1.4], COLORS.gold), wings(3.5, 1.3, 0.9), dish([0, 0, 0.85], 0.45)),
    },
  };

  // Which model fits a satellite: by name first, then by kind of orbit.
  function pick({ name, orbit }) {
    const n = name || "";
    if (/^ISS( \(|$)/.test(n)) return "iss";
    if (/^(CSS \(|TIANHE|TIANGONG)/.test(n)) return "css";
    if (/^(HST|HUBBLE)/.test(n)) return "hubble";
    const sl = /^STARLINK-(\d+)/.exec(n);
    if (sl) return +sl[1] >= 5000 ? "starlinkTwo" : "starlinkOne";
    if (/^(BLUEBIRD|BLUEWALKER|SPACEMOBILE)/.test(n)) return "bluebird";
    if (/R\/B/.test(n)) return "rocket";
    if (/ DEB/.test(n)) return "debris";
    if (/^(FLOCK|DOVE|SUPERDOVE|LEMUR|SPACEBEE|TIANQI|CUBESAT)|^ISS OBJECT/.test(n)) return "cubesat";
    if (/^(NAVSTAR|GPS |GSAT0|GALILEO|BEIDOU|QZS|IRNSS|NVS)|GLONASS/.test(n)) return "gnss";
    if (/^(NOAA|METOP|FENGYUN|FY-|SENTINEL|LANDSAT|TERRA|AQUA|METEOR)/.test(n)) return "weather";
    if (orbit === "GEO") return "geo";
    if (/^(ONEWEB|KUIPER|IRIDIUM|GLOBALSTAR|ORBCOMM|QIANFAN|COSMOS|YAOGAN|INTELSAT|SES|EUTELSAT)/.test(n)) return "generic";
    return "cube";
  }

  // ---- drawing ----
  const V = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  };
  const LIGHT = V.norm([-0.5, 0.75, 0.6]);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");   // no spinning on its own then
  const view = { canvas: null, faces: [], radius: 1, yaw: 0.7, pitch: -0.6, raf: 0, drag: null, idle: 0 };

  function frame() {
    view.raf = requestAnimationFrame(frame);
    const cv = view.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!view.drag && !reducedMotion.matches && performance.now() - view.idle > 2500) view.yaw += 0.006;   // slow spin when left alone

    const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
    const rot = ([x, y, z]) => { const x1 = cy * x + sy * z, z1 = -sy * x + cy * z; return [x1, cp * y - sp * z1, sp * y + cp * z1]; };
    const D = view.radius * 2.6, f = Math.min(w, h) * 0.8;
    const proj = q => [w / 2 + f * q[0] / (D - q[2]), h / 2 - f * q[1] / (D - q[2])];
    const drawn = [];
    for (const face of view.faces) {
      const q = face.p.map(rot), n = V.norm(V.cross(V.sub(q[1], q[0]), V.sub(q[2], q[0])));
      const mid = q.reduce((s, p) => [s[0] + p[0] / q.length, s[1] + p[1] / q.length, s[2] + p[2] / q.length], [0, 0, 0]);
      if (V.dot(n, V.sub([0, 0, D], mid)) <= 0) continue;   // facing away
      drawn.push({ face, s: q.map(proj), depth: D - mid[2], light: 0.45 + 0.6 * Math.max(0, V.dot(n, LIGHT)) });
    }
    drawn.sort((a, b) => b.depth - a.depth);
    for (const d of drawn) {
      const [r, g, b] = d.face.c.map(v => Math.round(v * d.light));
      ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = 0.6;
      ctx.beginPath(); d.s.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (d.face.solar && d.s.length === 4) {   // cell grid on the broad faces of solar panels
        const [a, b, c, e] = d.s, L = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
        const span = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(e[0] - a[0], e[1] - a[1]));
        if (span > 30) {
          ctx.strokeStyle = "rgba(160,190,255,0.25)"; ctx.beginPath();
          for (let k = 1; k < 6; k++) { const t = k / 6; let p = L(a, b, t), q = L(e, c, t); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); p = L(a, e, t); q = L(b, c, t); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
          ctx.stroke();
        }
      }
    }
  }

  function open(canvas, sat) {
    stop();
    const key = pick(sat), m = MODELS[key];
    view.canvas = canvas; view.faces = m.build();
    // centre the model on its bounding box, then size the view to fit it
    const pts = view.faces.flatMap(f => f.p), lo = [0, 1, 2].map(i => Math.min(...pts.map(p => p[i]))), hi = [0, 1, 2].map(i => Math.max(...pts.map(p => p[i])));
    const mid = [0, 1, 2].map(i => (lo[i] + hi[i]) / 2);
    view.faces = view.faces.map(f => ({ ...f, p: f.p.map(p => [p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]]) }));
    view.radius = Math.max(...view.faces.flatMap(f => f.p.map(p => Math.hypot(p[0], p[1], p[2])))) || 1;
    view.yaw = 0.7; view.pitch = -0.6; view.idle = 0;
    if (!canvas._wired) {
      canvas._wired = true;
      canvas.addEventListener("pointerdown", e => { view.drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch }; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener("pointermove", e => {
        if (!view.drag) return;
        view.yaw = view.drag.yaw + (e.clientX - view.drag.x) * 0.012;
        view.pitch = Math.max(-1.45, Math.min(1.45, view.drag.pitch + (e.clientY - view.drag.y) * 0.012));
      });
      const end = () => { view.drag = null; view.idle = performance.now(); };
      canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
    }
    frame();
    return { key, title: m.title, size: m.size, placeholder: key === "cube" };
  }
  function stop() { cancelAnimationFrame(view.raf); view.raf = 0; }

  window.Model3D = { open, stop, pick, titleOf: key => (MODELS[key] || MODELS.cube).title, models: Object.keys(MODELS) };
})();
