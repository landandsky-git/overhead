// Overhead: Saved places (home, a dark-sky spot…) and adding the app to the home screen.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// --- saved places: up to 8, in Settings under your location; each keeps its own horizon ---
const PLACES_MAX = 8;
const places = () => store.get("places", []);
const samePlace = (a, b) => a && b && Math.abs(a.lat - b.lat) < 0.005 && Math.abs(a.lon - b.lon) < 0.005;
function renderPlaces() {
  const list = places(), here = S.loc;
  $("placesList").innerHTML = list.map((p, i) => `<div class="saved${samePlace(p, here) ? " here" : ""}">
      <button class="saved-go" data-i="${i}" aria-current="${samePlace(p, here)}">${esc(p.name)}<span class="sub">${fmtLatLon(p.lat, p.lon)}</span></button>
      <button class="saved-del" data-del="${i}" aria-label="${esc(tl(`Remove ${p.name}`, `${p.name} entfernen`))}">✕</button></div>`).join("");
  $("savePlaceBtn").hidden = !here || list.some(p => samePlace(p, here)) || list.length >= PLACES_MAX;
}
$("savePlaceBtn").addEventListener("click", () => {
  if (!S.loc) return;
  const suggestion = placeName(S.loc) || (S.loc.src === "gps" ? tl("GPS location", "GPS-Standort") : tl("My place", "Mein Ort"));
  const name = (prompt(tl("A name for this place, e.g. Home or Dark-sky spot:", "Ein Name für diesen Ort, z. B. Zuhause oder Dunkler Platz:"), suggestion) || "").trim();
  if (!name) return;
  const { lat, lon, h } = S.loc;
  store.set("places", [...places(), { name: name.slice(0, 40), lat, lon, h: h || 0 }]);
  renderPlaces();
});
$("placesList").addEventListener("click", e => {
  const go = e.target.closest(".saved-go"), del = e.target.closest(".saved-del"), list = places();
  if (go) {
    const p = list[+go.dataset.i];
    if (p) { setLocation({ lat: p.lat, lon: p.lon, h: p.h || 0, name: p.name, src: "saved" }); showHint(tl(`Now showing the sky over ${p.name}.`, `Jetzt mit dem Himmel über ${p.name}.`), 4000); }
  } else if (del) {
    const p = list[+del.dataset.del];
    if (p && confirm(tl(`Remove “${p.name}” from your places?`, `„${p.name}“ aus deinen Orten entfernen?`))) { list.splice(+del.dataset.del, 1); store.set("places", list); renderPlaces(); }
  }
});

// --- add to home screen: then it opens full screen, like an app, and works offline ---
// Android browsers offer an install prompt the app can show from a button; on iPhones it's done from
// Safari's share menu, so there are instructions instead. Hidden once installed.
let installEvent = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvent = e; renderInstall(); });
addEventListener("appinstalled", () => { installEvent = null; renderInstall(); });
const isInstalled = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function renderInstall() {
  const group = $("installGroup");
  group.hidden = isInstalled();
  if (group.hidden) return;
  $("installBtn").hidden = !installEvent;
  $("installNote").textContent = installEvent
    ? tl("Install Overhead on this phone: it then opens full screen from your home screen and works without signal.",
         "Installiere Overhead auf diesem Handy: Dann startet es im Vollbild vom Startbildschirm und funktioniert auch ohne Empfang.")
    : isIPhone()
    ? tl("In Safari, tap the Share button (the square with an arrow), then “Add to Home Screen”. Overhead then opens full screen, like an app, and works without signal.",
         "Tippe in Safari auf die Teilen-Taste (das Quadrat mit dem Pfeil) und dann auf „Zum Home-Bildschirm“. Overhead startet dann im Vollbild wie eine App und funktioniert auch ohne Empfang.")
    : tl("Open your browser's menu and choose “Install app” or “Add to Home screen”. Overhead then opens full screen, like an app, and works without signal.",
         "Öffne das Menü deines Browsers und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“. Overhead startet dann im Vollbild wie eine App und funktioniert auch ohne Empfang.");
}
$("installBtn").addEventListener("click", async () => {
  if (!installEvent) return;
  installEvent.prompt();
  try { await installEvent.userChoice; } catch {}
  installEvent = null; renderInstall();
});
// A one-time tip on the third visit, for people who haven't found it in Settings.
function installTip() {
  const n = store.get("visits", 0) + 1;
  store.set("visits", n);
  if (n === 3 && !isInstalled()) setTimeout(() => showHint(tl("Tip: add Overhead to your home screen to use it like an app, even without signal. Settings → Install as an app.",
                                                              "Tipp: Leg Overhead auf deinen Startbildschirm, dann nutzt du es wie eine App, auch ohne Empfang. Einstellungen → Als App installieren."), 9000), 6000);
}
