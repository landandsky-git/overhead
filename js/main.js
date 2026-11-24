// Overhead: Starting the app.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// ---------- start ----------
async function begin(mode) {
  $("introErr").hidden = true;
  try { if (mode === "sensor") await startSensors(); else S.mode = "drag"; }
  catch (e) { $("introErr").textContent = e.message; $("introErr").hidden = false; return; }
  $("intro").hidden = true;
  try { await navigator.wakeLock?.request("screen"); } catch {}
  // A town picked by hand is kept; otherwise refresh from GPS.
  if (!S.loc || !S.loc.src || S.loc.src === "gps") {
    try { const l = await getLocation(); setLocation({ ...l, name: "Your GPS location", src: "gps" }); }
    catch (e) { if (!S.loc) { openSettings(); showHint(e.message, 6000); } }
  }
  renderSheet(); updateCard();
  if (!store.get("guideSeen", false)) openGuide();
}
$("startBtn").addEventListener("click", () => begin("sensor"));
$("dragBtn").addEventListener("click", () => begin("drag"));
document.addEventListener("visibilitychange", async () => {
  if (!document.hidden && S.mode) { try { await navigator.wakeLock?.request("screen"); } catch {} }
});

async function init() {
  loadColors(); resize(); sheetH();
  requestAnimationFrame(draw);
  if (typeof satellite === "undefined") { $("status").textContent = "Couldn't load the orbit library. Check your connection and reload."; return; }
  sendObs(); computeSky();
  setInterval(requestTick, 250);
  setInterval(() => { computeSky(); updateStatus(); updateCard(); refreshTimeLabels(); if (S.detailsId) renderNow(S.byId.get(S.detailsId)); }, 1000);
  setInterval(computePaths, 4000);
  setInterval(() => { if (S.tab === "now" && $("sheet").classList.contains("open") && document.activeElement !== $("findIn")) renderSheet(); }, 2000);
  setInterval(() => { if (S.tab === "tonight" && $("sheet").classList.contains("open")) renderSheet(); }, 30000);
  setInterval(() => { if (S.loc && S.counts.bright && Date.now() - S.passesAt > 30 * 60e3) requestPasses(); }, 2000);
  // If the big list was refused, try again once CelesTrak's 2-hour wait is over.
  setInterval(() => {
    if (!S.counts.starlink && !S.counts.other && !/^Loading/.test(S.loading) && Date.now() - store.get("tleFail_active", 0) > 2 * 3600e3) loadActive(false);
  }, 5 * 60e3);
  new ResizeObserver(sheetH).observe($("sheet"));
  // Offline support: keeps the app's files on the phone (see sw.js).
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  await loadSats(false);
}
init();
