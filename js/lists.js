// Overhead: The pull-up lists: now, tonight, passes and favorites.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// --- sheet: what's up now, search, passes ---
function satRow(sat, extraClass) {
  const n = S.nowMap.get(sat.idx), up = n && n.el > 0;
  const cls = `row ${up ? (n.lit ? "lit" : "") : "down"} ${sat.id === S.targetId ? "sel" : ""} ${extraClass || ""}`;
  const right = up ? `${compassName(n.az)} ${n.az.toFixed(0)}°<span class="sub">${n.el.toFixed(0)}° ${tl("up", "hoch")}</span>` : `<span class="sub">${tl("below horizon", "unter dem Horizont")}</span>`;
  const np = !up && isFav(sat) && S.loc ? nextPass(sat) : null;
  const sub = up ? `${n.lit ? magText(n.mag) : tl("in shadow", "im Schatten")} · ${fmtKm(n.range)}`
    : np ? tl(`rises ${fmtDayTime(np.start)} in the ${compassName(np.startAz)}${np.visible ? " (visible)" : ""}`, `geht ${fmtDayTime(np.start)} im ${compassName(np.startAz)} auf${np.visible ? " (sichtbar)" : ""}`)
    : isFav(sat) && S.loc ? tl("doesn't rise above 10° here in the next 2 days", "steigt hier in den nächsten 2 Tagen nicht über 10°") : `${CAT_LABEL[sat.cat]} · #${sat.id}`;
  return `<button class="${cls}" data-id="${sat.id}"><span class="dot"></span><span class="nm">${esc(favName(sat))}<span class="sub">${sub}</span></span><span class="num">${right}</span></button>`;
}

function renderSheet() {
  const box = $("listBox");
  // the selected tab is the one Tab lands on (arrow keys move between them) and labels the list
  for (const [id, tab] of TABS) { const on = S.tab === tab; $(id).setAttribute("aria-selected", on); $(id).tabIndex = on ? 0 : -1; if (on) $("sheetBody").setAttribute("aria-labelledby", id); }
  $("nowTools").hidden = S.tab !== "now";
  const body = $("sheetBody"), top = body.scrollTop;
  if (S.tab === "tonight") {
    renderTonight(box);
  } else if (S.tab === "space") {
    renderSpace(box);
  } else if (S.tab === "now") {
    const q = $("findIn").value.trim();
    const up = visibleNow();
    $("sheetTitle").textContent = `${upTitle()} · ${fmtN(up.length)}`;
    if (q) {
      const Q = q.toUpperCase(), hits = [];
      for (const s of S.sats) { if (s.nameU.includes(Q) || s.id === q || String(fromAlpha5(s.id)) === q) { hits.push(s); if (hits.length >= 60) break; } }
      hits.sort((a, b) => ((S.nowMap.get(b.idx)?.el ?? -99) > 0) - ((S.nowMap.get(a.idx)?.el ?? -99) > 0));
      box.innerHTML = hits.length ? hits.map(s => satRow(s)).join("") + (hits.length >= 60 ? `<div class="note">${tl("Showing the first 60 matches. Type more of the name to narrow it down.", "Die ersten 60 Treffer. Gib mehr vom Namen ein, um die Suche einzugrenzen.")}</div>` : "")
        : `<div class="empty">${tl(`No satellite matches “${esc(q)}”.`, `Kein Satellit passt zu „${esc(q)}“.`)}</div>`;
    } else if (!up.length) {
      box.innerHTML = `<div class="empty">${S.sats.length ? (S.loc ? tl("Nothing is above the horizon right now. Check which satellite types are switched on in Settings.", "Gerade ist nichts über dem Horizont. Prüfe in den Einstellungen, welche Satellitenarten eingeschaltet sind.")
        : tl("Set your location in Settings to see what's overhead.", "Lege in den Einstellungen deinen Standort fest, um zu sehen, was über dir ist.")) : tl("Loading satellite data…", "Satellitendaten werden geladen…")}</div>`;
    } else {
      const list = up.slice().sort((a, b) => (b.lit - a.lit) || (a.lit ? a.mag - b.mag : b.el - a.el));
      const shown = list.slice(0, 100);
      const favs = [...S.favs].map(id => S.byId.get(id)).filter(Boolean);
      box.innerHTML = (favs.length ? `<h4 class="tn-h">${tl("Favorites", "Favoriten")}</h4>` + favs.map(sat => satRow(sat)).join("") + `<h4 class="tn-h">${tl("Up now", "Jetzt am Himmel")}</h4>` : "") +
        `<div class="legend"><span class="l">${tl("Sunlit, brightest first", "Angestrahlt, hellste zuerst")}</span><span>${tl("In Earth's shadow", "Im Erdschatten")}</span></div>` +
        `<div class="note">${tl("Lower magnitude means brighter. Magnitude 6 is about the faintest you can see by eye in a dark sky.", "Kleinere Magnitude heißt heller. Magnitude 6 ist etwa das Schwächste, was man an einem dunklen Himmel mit bloßem Auge sieht.")}</div>` +
        shown.map(e => satRow(e.sat)).join("") +
        (list.length > shown.length ? `<div class="note">${tl(`Showing 100 of ${fmtN(list.length)} satellites above the horizon. Search above to find a specific one.`, `100 von ${fmtN(list.length)} Satelliten über dem Horizont. Suche oben nach einem bestimmten.`)}</div>` : "");
    }
  } else {
    $("sheetTitle").textContent = tl("Next 14 hours", "Nächste 14 Stunden");
    if (!S.passes) { box.innerHTML = `<div class="empty">${S.loc ? tl("Working out passes…", "Überflüge werden berechnet…") : tl("Set your location in Settings first.", "Lege zuerst in den Einstellungen deinen Standort fest.")}</div>`; }
    else {
      const list = S.passes.filter(p => p.end > Date.now()).slice(0, 60);
      S.passRows = list;
      box.innerHTML = `<div class="legend"><span class="l">${tl("Visible pass (sunlit, dark sky)", "Sichtbarer Überflug (angestrahlt, dunkler Himmel)")}</span><span>${tl("Not visible", "Nicht sichtbar")}</span></div>` +
        `<div class="note">${tl("Bright satellites, space stations and new Starlink trains passing above 15°. Tap any satellite to see its own passes.", "Helle Satelliten, Raumstationen und neue Starlink-Ketten, die höher als 15° vorbeiziehen. Tippe einen Satelliten an, um seine eigenen Überflüge zu sehen.")}</div>` +
        (list.length ? list.map((p, i) => `
        <button class="row ${p.visible ? "lit" : ""} ${p.sat.id === S.targetId ? "sel" : ""}" data-id="${p.sat.id}" data-pass="passes:${i}">
          <span class="dot"></span>
          <span class="nm">${esc(favName(p.sat))}<span class="sub">${compassName(p.startAz)} → ${compassName(p.endAz)} · ${tl("peak", "max.")} ${p.maxEl.toFixed(0)}°${p.blocked ? ` · ${tl("behind obstacles", "hinter Hindernissen")}` : p.visible ? ` · ${magText(p.mag)}` : ""}</span></span>
          <span class="num">${fmtTime(p.start)}<span class="sub">${dayWord(p.start)} · ${Math.max(1, Math.round((p.end - p.start) / 60000))} min</span></span>
        </button>`).join("") : `<div class="empty">${tl("No passes above 15° in the next 14 hours.", "Keine Überflüge über 15° in den nächsten 14 Stunden.")}</div>`);
    }
  }
  body.scrollTop = top;
}

$("listBox").addEventListener("click", e => {
  const sh = e.target.closest(".share");
  if (sh) { const p = S.tonightList?.[+sh.dataset.share]; if (p) sharePass(p); return; }
  const cal = e.target.closest(".cal");
  if (cal) { const p = S.tonightList?.[+cal.dataset.i]; if (p) addToCalendar(p); return; }
  const b = e.target.closest(".row");
  if (!b) return;
  // a pass: follow it on the sky; a satellite: open its details
  const [list, i] = (b.dataset.pass || "").split(":"), p = list && (list === "tonight" ? S.tonightList : S.passRows)?.[+i];
  if (p) watchPass(p.sat, p); else openDetails(b.dataset.id);
});
// The four tabs above the list. Arrow keys (and Home/End) move between them, as in any tab bar.
const TABS = [["tabNow", "now"], ["tabTonight", "tonight"], ["tabPasses", "passes"], ["tabSpace", "space"]];
for (const [id, tab] of TABS) $(id).addEventListener("click", () => { S.tab = tab; renderSheet(); setSheetOpen(true); });
document.querySelector(".tabs").addEventListener("keydown", e => {
  const ids = TABS.map(t => t[0]), i = ids.indexOf(document.activeElement.id), n = ids.length;
  const j = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
  if (i < 0 || j == null) return;
  e.preventDefault(); $(ids[j]).focus(); $(ids[j]).click();
});
$("findIn").addEventListener("input", () => { clearTimeout(renderSheet.t); renderSheet.t = setTimeout(renderSheet, 150); });
$("grab").addEventListener("click", () => setSheetOpen(!$("sheet").classList.contains("open")));
// Tapping anywhere on the card opens the details; keyboard users have the button at its foot.
$("card").addEventListener("click", () => { if (S.targetId) openDetails(S.targetId); });
$("cardClose").addEventListener("click", e => { e.stopPropagation(); setTarget(null); });
$("cardFav").addEventListener("click", e => { e.stopPropagation(); if (S.targetId) toggleFav(S.targetId); });
$("detFav").addEventListener("click", () => { if (S.detailsId) toggleFav(S.detailsId); });

// --- favourites: always labelled on the sky, listed first, and always in Tonight when visible ---
const isFav = sat => !!sat && S.favs.has(sat.id);
const favName = sat => (isFav(sat) ? "★ " : "") + sat.name;
function toggleFav(id) {
  if (S.favs.has(id)) S.favs.delete(id); else S.favs.add(id);
  store.set("favs", [...S.favs]);
  S.passesAt = 0;   // passes are worked out for favourites too
  updateFavButtons(); renderSheet();
}
function updateFavButtons() {
  const on = id => S.favs.has(id);
  if (S.targetId) { $("cardFav").textContent = on(S.targetId) ? "★" : "☆"; $("cardFav").setAttribute("aria-pressed", on(S.targetId)); $("cardFav").setAttribute("aria-label", on(S.targetId) ? tl("Remove from favorites", "Aus Favoriten entfernen") : tl("Add to favorites", "Zu Favoriten hinzufügen")); }
  if (S.detailsId) { $("detFav").textContent = on(S.detailsId) ? tl("★ Favorite", "★ Favorit") : tl("☆ Add to favorites", "☆ Zu Favoriten"); $("detFav").setAttribute("aria-pressed", on(S.detailsId)); }
}
function sheetH() { document.documentElement.style.setProperty("--sheet-h", $("sheet").offsetHeight + "px"); }
function setSheetOpen(open) {
  $("sheet").classList.toggle("open", open);
  $("grab").setAttribute("aria-expanded", open);
  sheetH();
}

// --- tonight: when it's dark, the clouds, the Moon and the best passes ---
// Dark enough for satellites = the Sun at least 6 degrees below the horizon. Scanned in 5-minute steps.
function nightWindow() {
  const lat = S.loc.lat * D2R, lon = S.loc.lon * D2R, step = 5 * 60e3, now = Date.now();
  const sunEl = t => { const d = new Date(t), s = sunPos(d); return raDecToAltAz(s.ra, s.dec, satellite.gstime(d), lat, lon).el; };
  let start = sunEl(now) < -6 ? now : null, end = null;
  for (let i = 1, t = now + step; i <= 288 && end == null; i++, t += step) {   // up to 24 hours ahead
    const dark = sunEl(t) < -6;
    if (dark && start == null) start = t;
    if (!dark && start != null) end = t;
  }
  return start == null ? null : { start, end: end ?? start + 24 * 3600e3, darkNow: start === now };
}
function moonTonight(win) {
  const lat = S.loc.lat * D2R, lon = S.loc.lon * D2R, step = 10 * 60e3;
  const moonUp = t => { const d = new Date(t), m = moonPos(d), a = raDecToAltAz(m.ra, m.dec, satellite.gstime(d), lat, lon); return a.el - m.parallax * Math.cos(a.el * D2R) > 0; };
  let prev = moonUp(win.start), rise = null, set = null, up = 0, n = 0;
  for (let t = win.start; t <= win.end; t += step) {
    const u = moonUp(t); n++; if (u) up++;
    if (u && !prev && rise == null) rise = t;
    if (!u && prev && set == null) set = t;
    prev = u;
  }
  return { share: up / n, rise, set };
}

// Hourly cloud cover from Open-Meteo, kept for an hour (and reused offline).
let clouds = null, cloudsLoading = false;
function cloudsKey() { return `${S.loc.lat.toFixed(2)},${S.loc.lon.toFixed(2)}`; }
function cloudsFresh() { return clouds && clouds.key === cloudsKey() && Date.now() - clouds.at < 3600e3; }
async function loadClouds() {
  if (cloudsLoading || !S.loc) return;
  const saved = store.get("clouds", null);
  if (saved && saved.key === cloudsKey()) clouds = saved;
  if (cloudsFresh()) return;
  cloudsLoading = true;
  try {
    const r = await fetchT(`https://api.open-meteo.com/v1/forecast?latitude=${S.loc.lat}&longitude=${S.loc.lon}&hourly=cloud_cover&forecast_days=2&timeformat=unixtime`, 10000);
    const j = await r.json();
    clouds = { key: cloudsKey(), at: Date.now(), t: j.hourly.time.map(s => s * 1000), c: j.hourly.cloud_cover };
    store.set("clouds", clouds);
  } catch {}
  cloudsLoading = false;
  if (S.tab === "tonight") renderSheet();
}
function cloudAt(t) {
  if (!clouds || clouds.key !== cloudsKey()) return null;
  let best = -1, bd = Infinity;
  clouds.t.forEach((x, i) => { const d = Math.abs(x - t); if (d < bd) { bd = d; best = i; } });
  return bd <= 3600e3 ? clouds.c[best] : null;
}
function cloudWord(c) { return c < 20 ? tl("Clear", "Klar") : c < 45 ? tl("Partly cloudy", "Teilweise bewölkt") : c < 75 ? tl("Mostly cloudy", "Überwiegend bewölkt") : tl("Overcast", "Bedeckt"); }

// The best visible passes tonight. Starlinks from one launch pass a minute or so apart, so they are
// shown together as a train.
function tonightPasses(win) {
  if (!S.passes) return null;
  const out = [], trains = new Map();
  const vis = S.passes.filter(p => p.visible && p.end > Date.now() && p.start < win.end && p.end > win.start).sort((a, b) => a.start - b.start);
  for (const p of vis) {
    if (/^STARLINK/.test(p.sat.nameU)) {
      const key = p.sat.l1.slice(9, 14), tr = trains.get(key);   // launch year + launch number
      if (tr && p.start - tr.last < 15 * 60e3) { tr.count++; tr.last = p.start; tr.mag = Math.min(tr.mag, p.mag); tr.end = Math.max(tr.end, p.end); continue; }
      const t = { ...p, count: 1, last: p.start, launch: intlDesig(p.sat.l1)?.code.replace(/[A-Z]+$/, "") };
      trains.set(key, t); out.push(t);
    } else out.push(p);
  }
  // brightest ten, with at most four Starlink entries so the rest of the sky gets a look in
  let starlinks = 0;
  const best = out.slice().sort((a, b) => a.mag - b.mag)
    .filter(p => !/^STARLINK/.test(p.sat.nameU) || ++starlinks <= 4)
    .slice(0, 10);
  for (const p of out) if (isFav(p.sat) && !best.includes(p)) best.push(p);   // favourites always make the list
  return best.sort((a, b) => a.start - b.start);
}
const passTitle = p => p.count > 1 ? tl(`Starlink train · ${p.count} satellites`, `Starlink-Kette · ${p.count} Satelliten`) : favName(p.sat);

function renderTonight(box) {
  $("sheetTitle").textContent = tl("Tonight", "Heute Nacht");
  if (!S.loc) { box.innerHTML = `<div class="empty">${tl("Set your location in Settings first.", "Lege zuerst in den Einstellungen deinen Standort fest.")}</div>`; return; }
  const win = nightWindow();
  if (!win) { box.innerHTML = `<div class="empty">${tl("It doesn't get dark enough tonight to see satellites: the Sun stays less than 6° below the horizon.", "Heute Nacht wird es nicht dunkel genug für Satelliten: Die Sonne bleibt weniger als 6° unter dem Horizont.")}</div>`; return; }
  if (!cloudsFresh()) loadClouds();

  // clouds, hour by hour through the dark hours
  const hours = [];
  for (let t = Math.floor(win.start / 3600e3) * 3600e3; t < win.end; t += 3600e3) hours.push([t, cloudAt(t)]);
  const known = hours.filter(h => h[1] != null);
  let cloudHtml;
  const cloudsK = tl("Clouds", "Wolken");
  if (!known.length) cloudHtml = `<div class="tn-line"><span class="tn-k">${cloudsK}</span><span>${cloudsLoading ? tl("Checking the forecast…", "Vorhersage wird geladen…") : tl("No forecast available (offline?)", "Keine Vorhersage verfügbar (offline?)")}</span></div>`;
  else {
    const avg = known.reduce((s, h) => s + h[1], 0) / known.length;
    let best = null, run = null;   // longest stretch under 40% cloud
    for (const [t, c] of hours) {
      if (c != null && c < 40) { run = run ? { ...run, to: t + 3600e3 } : { from: t, to: t + 3600e3 }; if (!best || run.to - run.from > best.to - best.from) best = run; }
      else run = null;
    }
    const clearNote = best && avg >= 20 ? ` · ${tl("clearest", "am klarsten")} ${fmtTime(Math.max(best.from, win.start))}–${fmtTime(Math.min(best.to, win.end))}` : "";
    cloudHtml = `<div class="tn-line"><span class="tn-k">${cloudsK}</span><span>${cloudWord(avg)} (${Math.round(avg)}${tl("%", " %")})${clearNote}</span></div>
      <div class="tn-line"><span></span><div class="clouds" style="grid-template-columns: repeat(${hours.length}, minmax(0, 1fr))" aria-label="${tl("Cloud cover by hour", "Bewölkung pro Stunde")}">${hours.map(([t, c]) =>
        `<div class="cc" title="${fmtTime(t)}: ${c ?? "?"}${tl("% cloud", " % Bewölkung")}"><b><span style="opacity:${c == null ? 0 : (c / 100).toFixed(2)}"></span></b><i>${new Date(t).getHours() % 3 === 0 ? fmtTime(t).replace(/:00(?!\d)/, "") : ""}</i></div>`).join("")}</div></div>`;
  }

  // the Moon: a bright Moon washes out faint satellites
  const mt = moonTonight(win), lit = sky.moon ? Math.round(sky.moon.lit * 100) : null;
  const moonWhen = mt.share === 0 ? tl("below the horizon all night", "die ganze Nacht unter dem Horizont") : mt.share === 1 ? tl("up all night", "die ganze Nacht am Himmel")
    : [mt.rise && tl(`rises ${fmtTime(mt.rise)}`, `geht ${fmtTime(mt.rise)} auf`), mt.set && tl(`sets ${fmtTime(mt.set)}`, `geht ${fmtTime(mt.set)} unter`)].filter(Boolean).join(", ");
  const moonNote = lit != null && lit > 60 && mt.share > 0.4 ? tl(". Its light hides fainter satellites", ". Sein Licht überstrahlt schwächere Satelliten") : "";

  const list = tonightPasses(win);
  S.tonightList = list;
  const passHtml = !list ? `<div class="empty">${tl("Working out tonight's passes…", "Die Überflüge für heute Nacht werden berechnet…")}</div>`
    : !list.length ? `<div class="empty">${tl("No bright passes in the dark hours tonight. Check the Passes tab for fainter ones.", "Heute Nacht keine hellen Überflüge in den dunklen Stunden. Schwächere findest du unter Überflüge.")}</div>`
    : list.map((p, i) => {
        const cc = cloudAt(p.maxTime), mins = Math.max(1, Math.round((p.end - p.start) / 60000));
        const sub = `${compassName(p.startAz)} → ${compassName(p.endAz)} · ${tl(`highest ${p.maxEl.toFixed(0)}° in the ${compassName(p.maxAz)}`, `am höchsten ${p.maxEl.toFixed(0)}° im ${compassName(p.maxAz)}`)} · ${magText(p.mag)}, ${brightWord(p.mag, p.limit)}` +
          (p.count > 1 ? ` · ${tl("launch", "Start")} ${p.launch}` : "") + (cc != null && cc >= 60 ? ` · ${cc}${tl("% cloud", " % Bewölkung")}` : "");
        return `<div class="pass">
          <button class="row lit ${p.sat.id === S.targetId ? "sel" : ""}" data-id="${p.sat.id}" data-pass="tonight:${i}"><span class="dot"></span>
            <span class="nm">${esc(passTitle(p))}<span class="sub tn-wrap">${sub}</span></span>
            <span class="num">${fmtTime(p.start)}<span class="sub">${dayWord(p.start)} · ${mins} min</span></span></button>
          <div class="pass-acts"><button class="cal" data-i="${i}">${tl("Add to calendar", "Zum Kalender")}</button><button class="cal share" data-share="${i}">${tl("Share", "Teilen")}</button></div></div>`;
      }).join("");

  const now = tl("Now", "Jetzt"), seeAt = win.darkNow ? Date.now() : win.start + 3600e3;
  box.innerHTML = `<div class="tonight">
      <div class="tn-line"><span class="tn-k">${tl("Dark", "Dunkel")}</span><span>${win.darkNow ? now : fmtDayTime(win.start)} ${tl("until", "bis")} ${fmtTime(win.end)}</span></div>
      ${cloudHtml}
      <div class="tn-line"><span class="tn-k">${tl("Seeing", "Sicht")}</span><span>${win.darkNow ? now : `${tl("From", "Ab")} ${fmtTime(seeAt)}`} ${seeingText(conditionsAt(seeAt))}</span></div>
      <div class="tn-line"><span class="tn-k">${tl("Moon", "Mond")}</span><span>${lit != null ? tl(`${lit}% lit, `, `${lit} % beleuchtet, `) : ""}${moonWhen}${moonNote}</span></div>
      ${skyGuideLines()}
    </div>
    <h4 class="tn-h">${tl("Best passes", "Beste Überflüge")}</h4>${passHtml}
    ${skyGuideComing()}`;
}

// A calendar file for one pass, with a reminder 10 minutes before.
const icsTime = ms => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = s => String(s).replace(/[\\;,]/g, m => "\\" + m).replace(/\n/g, "\\n");
const icsFold = line => line.length <= 73 ? line : line.match(/.{1,73}/g).join("\r\n ");
function addToCalendar(p) {
  const title = p.count > 1 ? tl(`Starlink train (${p.count} satellites)`, `Starlink-Kette (${p.count} Satelliten)`) : tl(`${p.sat.name} pass`, `Überflug ${p.sat.name}`);
  const [rise, top, set] = [p.startAz, p.maxAz, p.endAz].map(compassName), el = p.maxEl.toFixed(0), mag = fmtN(p.mag, 1), word = brightWord(p.mag, p.limit);
  const desc = tl(`Rises in the ${rise} at ${fmtTime(p.start)}, highest (${el}°) in the ${top} at ${fmtTime(p.maxTime)}, gone in the ${set} by ${fmtTime(p.end)}. Brightness about magnitude ${mag} (${word}).`,
                  `Geht um ${fmtTime(p.start)} im ${rise} auf, am höchsten (${el}°) im ${top} um ${fmtTime(p.maxTime)}, verschwindet bis ${fmtTime(p.end)} im ${set}. Helligkeit etwa Magnitude ${mag} (${word}).`);
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Overhead//Satellite pass//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${p.sat.id}-${p.start}@overhead`, `DTSTAMP:${icsTime(Date.now())}`, `DTSTART:${icsTime(p.start - 60e3)}`, `DTEND:${icsTime(p.end + 60e3)}`,
    `SUMMARY:${icsText(title)}`, `DESCRIPTION:${icsText(desc)}`, placeName(S.loc) ? `LOCATION:${icsText(S.loc.name)}` : "",
    "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", `DESCRIPTION:${icsText(title)} ${tl("in 10 minutes", "in 10 Minuten")}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"].filter(Boolean).map(icsFold).join("\r\n");
  const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (iOS) { location.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(ics); return; }   // Safari offers "Add to Calendar"
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `${title.replace(/[^\w]+/g, "-").replace(/-+$/, "").toLowerCase()}-${new Date(p.start).toISOString().slice(0, 10)}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  showHint(tl("Calendar file saved. Open it to add the pass, with a reminder 10 minutes before.", "Kalenderdatei gespeichert. Öffne sie, um den Überflug mit einer Erinnerung 10 Minuten vorher einzutragen."), 6000);
}
