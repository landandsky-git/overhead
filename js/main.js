// Overhead: Starting the app.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// ---------- start ----------
async function begin(mode) {
  $("introErr").hidden = true;
  try { if (mode === "sensor") await startSensors(); else S.mode = "drag"; }
  catch (e) { $("introErr").textContent = e.message; $("introErr").hidden = false; return; }
  $("intro").hidden = true; closeLayer($("intro"));
  $("motionBtn").hidden = false; updateModeUI();   // switch between following the phone and dragging (sensors.js)
  $("globeBtn").hidden = false;                    // the 3D globe (globe.js)
  try { await navigator.wakeLock?.request("screen"); } catch {}
  // A town picked by hand is kept; otherwise refresh from GPS.
  if (!S.loc || !S.loc.src || S.loc.src === "gps") {
    try { const l = await getLocation(); setLocation({ ...l, name: GPS_NAME, src: "gps" }); }
    catch (e) { if (!S.loc) { openSettings(); showHint(e.message, 6000); } }
  }
  renderSheet(); updateCard();
  if (!store.get("guideSeen", false)) openGuide();
  installTip();
}
$("startBtn").addEventListener("click", () => begin("sensor"));
$("dragBtn").addEventListener("click", () => begin("drag"));
document.addEventListener("visibilitychange", async () => {
  if (!document.hidden && S.mode) { try { await navigator.wakeLock?.request("screen"); } catch {} }
});

// A shared pass links here with the satellite in the address (…#sat=25544): it gets selected once
// the satellite data has loaded, and its next pass is followed.
const linkedSat = (/[#&]sat=([0-9A-Z]{5})\b/.exec(location.hash) || [])[1] || null;
// The Now list refreshes every 2 seconds, except while someone is typing a search or moving
// through it with the keyboard (rebuilding it would throw them out).
const listInUse = () => { const a = document.activeElement; return a === $("findIn") || ($("sheetBody").contains(a) && a.matches(":focus-visible")); };

async function init() {
  openLayer($("intro"), null);   // the start screen covers everything until Start is tapped
  loadColors(); resize(); sheetH();
  requestAnimationFrame(draw);
  if (typeof satellite === "undefined") { $("status").textContent = tl("Couldn't load the orbit library. Check your connection and reload.", "Die Bahnberechnung ließ sich nicht laden. Prüfe deine Verbindung und lade neu."); return; }
  sendObs(); loadSkyline(); computeSky();
  setInterval(requestTick, 250);
  setInterval(updateCompassPill, 1000);
  loadAurora(); setInterval(loadAurora, 30 * 60e3);   // NOAA's aurora forecast (skyguide.js), refreshed hourly
  loadComets();
  setInterval(() => { computeSky(); updateStatus(); updateCard(); refreshTimeLabels(); if (S.detailsId) renderNow(S.byId.get(S.detailsId)); }, 1000);
  setInterval(computePaths, 4000);
  setInterval(() => { if (S.tab === "now" && $("sheet").classList.contains("open") && !listInUse()) renderSheet(); }, 2000);
  setInterval(() => { if (S.tab === "tonight" && $("sheet").classList.contains("open")) renderSheet(); }, 30000);
  setInterval(() => { if (S.loc && S.counts.bright && Date.now() - S.passesAt > 30 * 60e3) requestPasses(); }, 2000);
  // If the big list was refused, try again once CelesTrak's 2-hour wait is over.
  setInterval(() => {
    if (!S.counts.starlink && !S.counts.other && !S.busy && Date.now() - store.get("tleFail_active", 0) > 2 * 3600e3) loadActive(false);
  }, 5 * 60e3);
  new ResizeObserver(sheetH).observe($("sheet"));
  // Offline support: keeps the app's files on the phone (see sw.js).
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  await loadSats(false);
  if (linkedSat) {
    if (S.byId.has(linkedSat)) setTarget(linkedSat);
    history.replaceState(null, "", location.pathname + location.search);   // a reload shouldn't select it again
  }
  loadSpace();   // launches and crew for the Space tab, kept for offline use
}
init();
