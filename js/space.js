// Overhead: The Space tab — upcoming rocket launches and the people in space right now.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// From data/space.json, which the GitHub workflow builds every 4 hours from The Space Devs'
// Launch Library 2. Kept on the phone so the tab also works offline (if a little dated).
let space = null, spaceLoading = false;
async function loadSpace() {
  if (spaceLoading) return;
  spaceLoading = true;
  const url = new URL("data/space.json", location.href).href, cache = await openCache();
  try {
    const r = await fetchT(url, 10000, { cache: "no-cache" });
    if (r.ok) {
      const text = await r.text();
      space = JSON.parse(text);
      if (cache) { try { await cache.put(url, new Response(text)); } catch {} }
    }
  } catch {}
  if (!space && cache) { try { const r = await cache.match(url); if (r) space = await r.json(); } catch {} }
  spaceLoading = false;
  if (S.tab === "space") renderSheet();
}

// Distance (km) between two places on Earth.
function distanceKm(lat1, lon1, lat2, lon2) {
  const a = Math.sin((lat2 - lat1) * D2R / 2) ** 2 + Math.cos(lat1 * D2R) * Math.cos(lat2 * D2R) * Math.sin((lon2 - lon1) * D2R / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
// Compass direction from one place to another.
function bearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * D2R) * Math.cos(lat2 * D2R);
  const x = Math.cos(lat1 * D2R) * Math.sin(lat2 * D2R) - Math.sin(lat1 * D2R) * Math.cos(lat2 * D2R) * Math.cos((lon2 - lon1) * D2R);
  return (Math.atan2(y, x) * R2D + 360) % 360;
}
// A rocket climbing through sunlight after dusk is spectacular from up to roughly 1,500 km away,
// low over the horizon in the launch site's direction.
function launchSighting(l) {
  if (!S.loc || l.lat == null) return null;
  const km = distanceKm(S.loc.lat, S.loc.lon, l.lat, l.lon), dist = fmtN(Math.round(km));
  if (km > 1500) return null;
  const c = conditionsAt(Date.parse(l.net));
  if (c.sunEl > -4) return { km, text: tl(`${dist} km away, but in daylight or bright twilight here`, `${dist} km entfernt, aber hier bei Tageslicht oder heller Dämmerung`) };
  const dir = compassName(bearing(S.loc.lat, S.loc.lon, l.lat, l.lon));
  return { km, text: tl(`may be visible from you, low in the ${dir} (${dist} km away)`, `vielleicht bei dir zu sehen, tief im ${dir} (${dist} km entfernt)`), good: true };
}
// Which station someone is on: Chinese astronauts are on Tiangong, everyone else on the ISS.
const stationOf = p => /^(CNSA|CMSA)$/.test(p.agency || "") ? "Tiangong" : "ISS";
// Launch Library's mission types, in German.
const MISSION_DE = {
  "Communications": "Kommunikation", "Earth Science": "Erdbeobachtung", "Government/Top Secret": "Regierung/geheim",
  "Human Exploration": "Bemannte Raumfahrt", "Resupply": "Versorgung", "Navigation": "Navigation", "Tourism": "Tourismus",
  "Test Flight": "Testflug", "Planetary Science": "Planetenforschung", "Astrophysics": "Astrophysik", "Heliophysics": "Sonnenphysik",
  "Technology": "Technik", "Dedicated Rideshare": "Sammelstart", "Robotic Exploration": "Robotische Erkundung",
  "Space Science": "Weltraumforschung", "Lunar Exploration": "Mondforschung", "Unknown": "Unbekannt",
};
const missionType = t => t ? tl(t, MISSION_DE[t] || t) : "";

function renderSpace(box) {
  $("sheetTitle").textContent = tl("Space", "Raumfahrt");
  if (!space) {
    box.innerHTML = `<div class="empty">${spaceLoading ? tl("Loading launches…", "Starts werden geladen…") : tl("Launch information isn't available (offline?).", "Keine Startdaten verfügbar (offline?).")}</div>`;
    if (!spaceLoading) loadSpace();
    return;
  }
  const now = Date.now();
  const launches = space.launches.filter(l => Date.parse(l.net) > now - 6 * 3600e3).slice(0, 12);
  const when = l => {
    const t = Date.parse(l.net), days = (t - now) / 86400e3;
    if (t < now) return l.status === "Success" ? tl("launched", "gestartet") : l.status === "Failure" ? tl("failed", "gescheitert") : tl("just launched", "gerade gestartet");
    if (l.precision && !/second|minute|hour/i.test(l.precision)) return fmtDate(new Date(t));
    return days < 6 ? fmtDayTime(t) : fmtDate(new Date(t));
  };
  const rows = launches.map(l => {
    const [rocket, mission] = (l.name || "").split(" | "), seen = launchSighting(l);
    return `<div class="row launch ${seen && seen.good ? "lit" : ""}"><span class="dot"></span>
      <span class="nm">${esc(mission || rocket)}<span class="sub tn-wrap">${esc(rocket)} · ${esc(l.provider || "")}${l.crewed ? tl(" · with crew", " · mit Besatzung") : ""}<br>${esc(l.place || l.pad || "")}${seen ? ` · ${esc(seen.text)}` : ""}</span></span>
      <span class="num">${esc(when(l))}<span class="sub">${esc(missionType(l.mission))}</span></span></div>`;
  }).join("");
  const byStation = {};
  for (const p of space.crew) (byStation[stationOf(p)] = byStation[stationOf(p)] || []).push(p);
  const crew = Object.entries(byStation).map(([st, people]) => `<div class="tn-line"><span class="tn-k">${st}</span><span>${people.map(p => {
    const days = p.since ? Math.max(1, Math.floor((now - Date.parse(p.since)) / 86400e3)) : null;
    return `${esc(p.name)} <span class="small">(${esc(p.agency || p.country || "")}${days ? `, ${tl("day", "Tag")} ${days}` : ""})</span>`;
  }).join(", ")}</span></div>`).join("");
  const updated = space.updated ? tl(`updated ${fmtDate(new Date(space.updated))} ${fmtTime(Date.parse(space.updated))}`, `Stand ${fmtDate(new Date(space.updated))}, ${fmtTime(Date.parse(space.updated))}`) : tl("updated every few hours", "alle paar Stunden aktualisiert");
  box.innerHTML = `<h4 class="tn-h">${tl(`In space now · ${space.crew.length} people`, `Jetzt im All · ${space.crew.length} Menschen`)}</h4><div class="tonight">${crew}</div>
    <h4 class="tn-h">${tl("Next launches", "Nächste Starts")}</h4>${rows || `<div class="empty">${tl("No launches listed.", "Keine Starts angekündigt.")}</div>`}
    <div class="note">${tl(`From The Space Devs' Launch Library 2, ${updated}. Times are planned and often slip.`, `Aus der Launch Library 2 von The Space Devs, ${updated}. Die Zeiten sind geplant und verschieben sich oft.`)}</div>`;
}
$("tabSpace").addEventListener("click", () => { S.tab = "space"; $("sheet").classList.add("open"); renderSheet(); sheetH(); });
