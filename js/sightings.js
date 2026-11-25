// Overhead: "Saw it / couldn't see it" — your own sightings correct the brightness estimates.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// Corrections in magnitudes (negative = brighter), kept on the phone:
//   sat[id]   for that one satellite (learns fully from each sighting)
//   kind[key] for its kind of satellite, e.g. all Starlink V2 Minis (learns gently, applies when the
//             satellite itself has no sightings yet)
const SIGHT = Object.assign({ sat: {}, kind: {} }, store.get("sightings", {}));
const sightAsked = new Map();   // id -> time of the last answer, so one pass isn't counted twice

// The kind of satellite (the same groups as the 3D models). Worked out from the name and, for
// geostationary ones, straight from the orbit numbers in line 2 (1 orbit a day, nearly circular),
// which is much cheaper than a full orbit setup for each of the 17,000 satellites.
const isGeoLine = l2 => { const n = parseFloat(l2.slice(52, 63)), e = parseFloat("0." + l2.slice(26, 33).trim()); return n > 0.9 && n < 1.11 && e < 0.1; };
const kindOf = sat => sat.kind || (sat.kind = window.Model3D ? Model3D.pick({ name: sat.nameU, orbit: isGeoLine(sat.l2) ? "GEO" : "" }) : sat.cat);
function sightingCorrection(sat) {
  const own = SIGHT.sat[sat.id];
  if (own) return own.d;
  for (const _ in SIGHT.kind) { const k = SIGHT.kind[kindOf(sat)]; return k ? k.d : 0; }
  return 0;   // no sightings yet: nothing to look up
}

// Can the viewer be asked about this satellite right now? Above the horizon, sunlit, dark sky, and
// bright enough that seeing it is plausible (no point asking about one far too faint for the sky).
function canAskSighting(sat, n) {
  return !!n && n.el > 5 && n.lit && sky.sunEl < -6 && !S.timeOffset && n.mag <= limitNow() + 1.5 &&
    !(Date.now() - (sightAsked.get(sat.id) || 0) < 5 * 60e3);
}

// saw = true: it was visible, so it must be at least as bright as the limit right now.
// saw = false: it wasn't, so it must be fainter than that.
function recordSighting(sat, saw) {
  const n = S.nowMap.get(sat.idx);
  if (!n || !n.lit) { showHint(saw ? tl("Noted.", "Notiert.") : tl("That fits: it's in Earth's shadow right now, so it can't be seen.", "Das passt: Er ist gerade im Erdschatten und daher nicht zu sehen."), 5000); return; }
  sightAsked.set(sat.id, Date.now());
  const L = limitNow(), target = saw ? L - 0.3 : L + 0.3;
  const delta = saw ? Math.min(0, target - n.mag) : Math.max(0, target - n.mag);
  if (!delta) { showHint(tl(`Thanks. That matches the estimate (magnitude ${fmtN(n.mag, 1)}, your sky shows down to ${fmtN(L, 1)}).`, `Danke. Das passt zur Schätzung (Magnitude ${fmtN(n.mag, 1)}, dein Himmel zeigt bis ${fmtN(L, 1)}).`), 6000); return; }
  const key = kindOf(sat), clamp = (v, m) => Math.max(-m, Math.min(m, v));
  const own = SIGHT.sat[sat.id] || { d: sightingCorrection(sat), n: 0 };
  own.d = clamp(own.d + delta, 3); own.n++;
  SIGHT.sat[sat.id] = own;
  const kind = SIGHT.kind[key] || { d: 0, n: 0 };
  kind.d = clamp(kind.d + delta * 0.3, 2); kind.n++;
  SIGHT.kind[key] = kind;
  store.set("sightings", SIGHT);
  applySightings(s => s === sat || kindOf(s) === key);
  const by = fmtN(Math.abs(delta), 1), brighter = delta < 0, others = key !== "cube";
  showHint(tl(`Thanks. The app now expects ${sat.name} to look ${by} magnitudes ${brighter ? "brighter" : "fainter"}` + (others ? `, and other satellites of its kind a little ${brighter ? "brighter" : "fainter"} too.` : "."),
              `Danke. Die App erwartet ${sat.name} jetzt um ${by} Magnituden ${brighter ? "heller" : "schwächer"}` + (others ? `, und andere Satelliten dieser Art etwas ${brighter ? "heller" : "schwächer"}.` : ".")), 8000);
}

// Re-apply corrections to the satellites that changed and tell the background worker.
function applySightings(which) {
  const list = [];
  for (const s of S.sats) {
    if (which && !which(s)) continue;
    const m0 = s.m0base + sightingCorrection(s);
    if (m0 !== s.m0) { s.m0 = m0; list.push([s.idx, m0]); }
  }
  if (list.length) worker.postMessage({ type: "mags", list });
  S.passesAt = 0;   // passes depend on brightness too
}
function forgetSightings() {
  SIGHT.sat = {}; SIGHT.kind = {};
  store.set("sightings", SIGHT);
  applySightings();
  showHint(tl("Your sightings are forgotten. Brightness is back to the app's estimates.", "Deine Sichtungen sind vergessen. Die Helligkeit folgt wieder den Schätzungen der App."), 5000);
}
const sightingCount = () => Object.values(SIGHT.sat).reduce((t, s) => t + s.n, 0);
// For the details panel: how far your sightings have moved this satellite's brightness.
function sightingNote(sat) {
  const d = sat.m0base != null ? sat.m0 - sat.m0base : 0, by = fmtN(Math.abs(d), 1);
  return Math.abs(d) < 0.05 ? "" : tl(` Adjusted ${by} ${d < 0 ? "brighter" : "fainter"} by your sightings.`, ` Durch deine Sichtungen um ${by} ${d < 0 ? "heller" : "schwächer"} angepasst.`);
}
function renderSightNote() {
  const n = sightingCount(), sats = Object.keys(SIGHT.sat).length;
  $("sightNote").textContent = n
    ? tl(`You've reported ${n} sighting${n === 1 ? "" : "s"} of ${sats} satellite${sats === 1 ? "" : "s"}. The app uses them to correct its brightness estimates for those satellites, and a little for others of the same kind.`,
         `Du hast ${n} Sichtung${n === 1 ? "" : "en"} von ${sats} Satellit${sats === 1 ? "" : "en"} gemeldet. Die App korrigiert damit ihre Helligkeitsschätzung für diese Satelliten und ein wenig für andere derselben Art.`)
    : tl("When a satellite you've selected is up in a dark sky, the card asks whether you saw it. Your answers correct the app's brightness estimates.",
         "Wenn ein ausgewählter Satellit am dunklen Himmel steht, fragt die Karte, ob du ihn gesehen hast. Deine Antworten korrigieren die Helligkeitsschätzungen der App.");
  $("sightReset").hidden = !n;
}

$("sawYes").addEventListener("click", e => { e.stopPropagation(); const s = S.byId.get(S.targetId); if (s) { recordSighting(s, true); updateCard(); } });
$("sawNo").addEventListener("click", e => { e.stopPropagation(); const s = S.byId.get(S.targetId); if (s) { recordSighting(s, false); updateCard(); } });
