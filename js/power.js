// Overhead: Battery saver and red night mode.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// The sky normally redraws about 60 times a second. When the phone has been still for a moment and
// nobody is touching the screen, 10 a second is plenty (satellites move a few pixels a second), and
// while a full-screen panel covers the sky, 2 a second.
const PACE = { last: 0, sig: [], stillSince: 0 };
function skipFrame() {
  const now = performance.now();
  if (!S.battery) return false;
  const covered = !$("details").hidden || !$("settings").hidden || !$("intro").hidden || !$("globe").hidden;
  const sig = [...(S.mode === "sensor" && S.R ? S.R : [S.view.az, S.view.el]), S.vfov, S.timeOffset];
  let change = sig.length !== PACE.sig.length ? 1 : 0;
  for (let i = 0; !change && i < sig.length; i++) if (Math.abs(sig[i] - PACE.sig[i]) > 0.0006) change = 1;
  if (change || fingers.size || drag || ALIGN.on || IDENT.on) PACE.stillSince = now;
  const interval = covered ? 500 : now - PACE.stillSince > 1500 ? 100 : 0;
  if (now - PACE.last < interval) return true;
  PACE.last = now; PACE.sig = sig;
  return false;
}

// Red night mode keeps your eyes used to the dark: off, red, dim red.
function applyRed(level) {
  document.body.classList.toggle("red", level > 0);
  document.body.classList.toggle("dim", level > 1);
  $("redBtn").setAttribute("aria-pressed", level > 0);
  const label = tl(["Red night mode", "Red night mode: tap again for dimmer", "Dim red: tap again to turn off"],
                   ["Rotlicht-Nachtmodus", "Rotlicht: noch einmal tippen für dunkler", "Dunkles Rot: noch einmal tippen zum Ausschalten"])[level];
  $("redBtn").title = label; $("redBtn").setAttribute("aria-label", label);
  $("redBtn").textContent = level > 1 ? "R−" : "R";
  store.set("red", level);
}
$("redBtn").addEventListener("click", () => applyRed((Number(store.get("red", 0)) + 1) % 3));
applyRed(Number(store.get("red", 0)) || 0);
