// Overhead: Time slider, sky darkness, quick guide and settings.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// --- time slider: see the sky up to 2 hours back or 12 hours ahead ---
function fmtOffset(ms) {
  const m = Math.round(ms / 60000), a = Math.abs(m), h = Math.floor(a / 60), mm = a % 60;
  return (m < 0 ? "−" : "+") + [h ? `${h} h` : "", mm || !h ? `${mm} min` : ""].filter(Boolean).join(" ");
}
function refreshTimeLabels() {
  const t = simNow(), shifted = S.timeOffset !== 0;
  $("timeLabel").textContent = shifted ? `${dayWord(t)} ${fmtTime(t)} · ${fmtOffset(S.timeOffset)}` : `Now · ${fmtTime(t)}`;
  $("timePill").textContent = `Showing ${dayWord(t)} ${fmtTime(t)} (${fmtOffset(S.timeOffset)}) · tap to change`;
  $("timePill").hidden = !shifted || !$("timeBar").hidden;
  document.body.classList.toggle("timeshift", shifted && $("timeBar").hidden);
}
function setTimeOffset(minutes) {
  if (Math.abs(minutes) <= 3) minutes = 0;   // snap to now
  S.timeOffset = minutes * 60000;
  $("timeIn").value = minutes;
  tickBusy = false; requestTick();
  computeSky(); computePaths(); updateCard(); updateStatus(); refreshTimeLabels();
  if (S.detailsId) renderNow(S.byId.get(S.detailsId));
}
function timeBarH() { document.documentElement.style.setProperty("--tb-h", $("timeBar").hidden ? "0px" : $("timeBar").offsetHeight + "px"); }
function openTimeBar() { $("timeBar").hidden = false; timeBarH(); refreshTimeLabels(); }
function closeTimeBar() { $("timeBar").hidden = true; timeBarH(); refreshTimeLabels(); }
$("timeBtn").addEventListener("click", () => $("timeBar").hidden ? openTimeBar() : closeTimeBar());
$("timePill").addEventListener("click", openTimeBar);
$("timeIn").addEventListener("input", e => setTimeOffset(+e.target.value));
$("timeNow").addEventListener("click", () => setTimeOffset(0));
$("timeClose").addEventListener("click", closeTimeBar);

// --- your sky: how faint you can see ---
function renderSkySetting() {
  $("skyIn").innerHTML = SKY_LIMITS.map(([v, name]) => `<button role="radio" aria-checked="${v === S.limit}" data-v="${v}">${name}</button>`).join("");
  const now = S.loc ? conditionsAt(Date.now()) : null;
  $("skyNote").textContent = `On a dark, moonless night you see down to magnitude ${S.limit}. Twilight and moonlight lower that, and the app allows for both` +
    (now && now.sunEl < -6 ? `: right now ${seeingText(now)}.` : ".");
}
$("skyIn").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  S.limit = +b.dataset.v; store.set("limit", S.limit);
  S.passesAt = 0;   // which passes count as visible changes too
  renderSkySetting(); renderSheet(); updateStatus(); updateCard();
});

// --- quick guide: six short steps, each pointing at the button it explains ---
const GUIDE = [
  { title: "Point your phone at the sky", spot: [],
    text: "Hold your phone up like a window onto the sky. The satellites in that direction appear on screen. Gold dots are lit by the sun, and the bigger the dot, the brighter it looks. Blue dots are in Earth's shadow, so you can't see them." },
  { title: "Line up the compass", spot: ["alignBtn"],
    text: "Phone compasses are often a few degrees off. Tap ◎, center a bright star, planet or the Moon in the camera picture, and tap its name. Everything then lines up with the real sky." },
  { title: "Tap a satellite", spot: [],
    text: "Tap a dot to see where to look and what it is. Tap the card for who runs it, when it launched and its orbit, and tap ☆ to make it a favorite. Favorites are always labelled." },
  { title: "Plan your night", spot: ["tabTonight"],
    text: "Tonight shows when it gets dark, the clouds, the Moon and the best passes. Tap a pass to follow it: you get its path across the sky, a countdown, and a buzz when it rises." },
  { title: "Saw something move?", spot: ["grab"],
    text: "Open the list and tap “Saw something moving?”. Point where you saw it, and the app finds out which satellite it was." },
  { title: "A few more buttons", spot: ["timeBtn", "redBtn", "setBtn"],
    text: "◷ shows the sky up to 12 hours ahead. R turns the screen red so your eyes stay used to the dark. ⚙ has your location, how dark your sky is, and this guide." },
];
let guideAt = 0;
function showGuideStep() {
  document.querySelectorAll(".spot").forEach(el => el.classList.remove("spot"));
  const g = GUIDE[guideAt];
  $("guideStep").textContent = `${guideAt + 1} OF ${GUIDE.length}`;
  $("guideTitle").textContent = g.title;
  $("guideText").textContent = g.text;
  $("guideNext").textContent = guideAt === GUIDE.length - 1 ? "Done" : "Next";
  g.spot.forEach(id => $(id).classList.add("spot"));
}
function openGuide() { guideAt = 0; $("guide").hidden = false; showGuideStep(); $("guideNext").focus(); }
function closeGuide() {
  document.querySelectorAll(".spot").forEach(el => el.classList.remove("spot"));
  $("guide").hidden = true; store.set("guideSeen", true);
}
$("guideNext").addEventListener("click", () => { if (++guideAt >= GUIDE.length) closeGuide(); else showGuideStep(); });
$("guideSkip").addEventListener("click", closeGuide);
$("guideBtn").addEventListener("click", () => { $("settings").hidden = true; openGuide(); });

// --- settings ---
function updateLocNow() {
  $("locNow").innerHTML = S.loc
    ? `${esc(S.loc.name || "Custom coordinates")}<span class="sub">${fmtLatLon(S.loc.lat, S.loc.lon)}${S.loc.h ? ` · ${Math.round(S.loc.h).toLocaleString("en")} m` : ""}</span>`
    : `Not set yet<span class="sub">Search for your town below</span>`;
}
function updateTleInfo() {
  const n = S.counts, total = n.bright + n.starlink + n.other;
  $("cntBright").textContent = n.bright.toLocaleString("en");
  $("cntStarlink").textContent = n.starlink.toLocaleString("en");
  $("cntOther").textContent = n.other.toLocaleString("en");
  $("tleInfo").textContent = total ? `${total.toLocaleString("en")} satellites from CelesTrak${S.tleTime ? `, downloaded ${fmtDate(new Date(S.tleTime))} ${fmtTime(S.tleTime)}` : ""}. Updates itself every 6 hours.` : "No satellite data yet.";
}
function openSettings() {
  $("latIn").value = S.loc?.lat ?? ""; $("lonIn").value = S.loc?.lon ?? "";
  $("corrIn").value = S.corr; $("corrVal").textContent = (S.corr > 0 ? "+" : "") + S.corr + "°";
  $("showBright").checked = S.show.bright; $("showStarlink").checked = S.show.starlink; $("showOther").checked = S.show.other;
  $("eyeOnly").checked = S.eyeOnly;
  $("locErr").hidden = true;
  updateLocNow(); updateTleInfo(); renderSkySetting(); $("settings").hidden = false;
}
function setLocation(loc) {
  S.loc = loc; store.set("loc", loc);
  sendObs(); S.passes = null; S.passesAt = 0; S.passJob++;
  computeSky(); updateLocNow(); updateStatus(); renderSheet(); updateCard();
}
$("setBtn").addEventListener("click", openSettings);
$("setDone").addEventListener("click", () => {
  if (!S.loc) { $("locErr").textContent = "Choose a location first, so the app knows which part of the sky you see."; $("locErr").hidden = false; return; }
  $("settings").hidden = true;
});
$("corrIn").addEventListener("input", e => { S.corr = +e.target.value; $("corrVal").textContent = (S.corr > 0 ? "+" : "") + S.corr + "°"; store.set("corr", S.corr); });
$("eyeOnly").addEventListener("change", e => { S.eyeOnly = e.target.checked; store.set("eyeOnly", S.eyeOnly); renderSheet(); updateStatus(); });
for (const [id, cat] of [["showBright", "bright"], ["showStarlink", "starlink"], ["showOther", "other"]]) {
  $(id).addEventListener("change", e => { S.show[cat] = e.target.checked; store.set("show", S.show); computePaths(); renderSheet(); updateStatus(); });
}

let placeTimer = 0, placeCtl = null, placeList = [];
$("placeIn").addEventListener("input", () => { clearTimeout(placeTimer); placeTimer = setTimeout(searchPlaces, 300); });
async function searchPlaces() {
  const q = $("placeIn").value.trim(), box = $("placeResults");
  if (q.length < 2) { box.innerHTML = ""; return; }
  if (placeCtl) placeCtl.abort();
  placeCtl = new AbortController();
  box.innerHTML = `<p class="small">Searching…</p>`;
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`, { signal: placeCtl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    placeList = (await r.json()).results || [];
    box.innerHTML = placeList.length ? placeList.map((p, i) => `
      <button class="place" data-i="${i}"><span>${esc(p.name)}</span>
      <span class="sub">${esc([p.admin1, p.country].filter(Boolean).join(", "))} · ${fmtLatLon(p.latitude, p.longitude)}</span></button>`).join("")
      : `<p class="small">No places found for "${esc(q)}". Try another spelling or a larger town nearby.</p>`;
  } catch (e) {
    if (e.name !== "AbortError") box.innerHTML = `<p class="err">Couldn't search right now. Check your connection, or use GPS or coordinates instead.</p>`;
  }
}
$("placeResults").addEventListener("click", e => {
  const b = e.target.closest(".place"); if (!b) return;
  const p = placeList[+b.dataset.i];
  setLocation({ lat: +p.latitude.toFixed(4), lon: +p.longitude.toFixed(4), h: p.elevation || 0, name: [p.name, p.admin1 || p.country].filter(Boolean).join(", "), src: "search" });
  $("placeResults").innerHTML = ""; $("placeIn").value = ""; $("locErr").hidden = true;
});
$("gpsBtn").addEventListener("click", async () => {
  const b = $("gpsBtn"); b.textContent = "Finding you…";
  try { const l = await getLocation(); setLocation({ ...l, name: "Your GPS location", src: "gps" }); $("locErr").hidden = true; }
  catch (e) { $("locErr").textContent = e.message; $("locErr").hidden = false; }
  b.textContent = "Use my phone's GPS instead";
});
$("coordBtn").addEventListener("click", () => {
  const lat = parseFloat($("latIn").value), lon = parseFloat($("lonIn").value);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    $("locErr").textContent = "Latitude must be between -90 and 90, and longitude between -180 and 180."; $("locErr").hidden = false; return;
  }
  setLocation({ lat, lon, h: 0, name: null, src: "manual" }); $("locErr").hidden = true;
});
$("refreshBtn").addEventListener("click", async () => {
  const b = $("refreshBtn"); b.textContent = "Downloading…"; b.disabled = true;
  await loadSats(true);
  b.textContent = "Download fresh satellite data"; b.disabled = false;
});
