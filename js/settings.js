// Overhead: Time slider, sky darkness, quick guide and settings.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// --- time slider: see the sky up to 2 hours back or 12 hours ahead ---
function fmtOffset(ms) {
  const m = Math.round(ms / 60000), a = Math.abs(m), h = Math.floor(a / 60), mm = a % 60;
  return (m < 0 ? "−" : "+") + [h ? `${h} ${U.h}` : "", mm || !h ? `${mm} ${U.min}` : ""].filter(Boolean).join(" ");
}
function refreshTimeLabels() {
  const t = simNow(), shifted = S.timeOffset !== 0;
  $("timeLabel").textContent = shifted ? `${dayWord(t)} ${fmtTime(t)} · ${fmtOffset(S.timeOffset)}` : `${tl("Now", "Jetzt", "Зараз")} · ${fmtTime(t)}`;
  $("timePill").textContent = tl(`Showing ${dayWord(t)} ${fmtTime(t)} (${fmtOffset(S.timeOffset)}) · tap to change`, `Zeigt ${dayWord(t)} ${fmtTime(t)} (${fmtOffset(S.timeOffset)}) · tippen zum Ändern`, `Небо на ${dayWord(t)} ${fmtTime(t)} (${fmtOffset(S.timeOffset)}) · торкнися, щоб змінити`);
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
function openTimeBar() { $("timeBar").hidden = false; $("timeBtn").setAttribute("aria-expanded", true); timeBarH(); refreshTimeLabels(); }
function closeTimeBar() { $("timeBar").hidden = true; $("timeBtn").setAttribute("aria-expanded", false); timeBarH(); refreshTimeLabels(); }
$("timeBtn").addEventListener("click", () => $("timeBar").hidden ? openTimeBar() : closeTimeBar());
$("timePill").addEventListener("click", openTimeBar);
$("timeIn").addEventListener("input", e => setTimeOffset(+e.target.value));
$("timeNow").addEventListener("click", () => setTimeOffset(0));
$("timeClose").addEventListener("click", closeTimeBar);

// --- your sky: how faint you can see ---
function renderSkySetting() {
  $("skyIn").innerHTML = SKY_LIMITS.map(([v, name]) => `<button role="radio" aria-checked="${v === S.limit}" data-v="${v}">${name}</button>`).join("");
  const now = S.loc ? conditionsAt(Date.now()) : null;
  $("skyNote").textContent = tl(`On a dark, moonless night you see down to magnitude ${fmtN(S.limit, 1)}. Twilight and moonlight lower that, and the app allows for both`,
                                `In einer dunklen, mondlosen Nacht siehst du bis Magnitude ${fmtN(S.limit, 1)}. Dämmerung und Mondlicht verringern das, und die App berücksichtigt beides`,
                                `У темну безмісячну ніч ти бачиш зорі до зоряної величини ${fmtN(S.limit, 1)}. Сутінки й місячне світло знижують цю межу, і застосунок враховує обидва чинники`) +
    (now && now.sunEl < -6 ? `: ${tl("right now", "gerade", "зараз")} ${seeingText(now)}.` : ".");
}

// --- text size: page zoom is off (pinching zooms the sky), so the app scales its own text ---
const TEXT_SIZES = [[1, tl("Normal", "Normal", "Звичайний")], [1.15, tl("Large", "Groß", "Великий")], [1.3, tl("Largest", "Sehr groß", "Найбільший")]];
function renderTextSetting() {
  const now = store.get("textSize", 1);
  $("textIn").innerHTML = TEXT_SIZES.map(([v, name]) => `<button role="radio" aria-checked="${v === now}" data-v="${v}">${name}</button>`).join("");
}
$("textIn").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  store.set("textSize", +b.dataset.v);
  document.documentElement.style.setProperty("--text", b.dataset.v);
  renderTextSetting(); sheetH(); timeBarH();
  $("textIn").querySelector(`[data-v="${b.dataset.v}"]`).focus();
});

// --- language: automatic (the phone's), English, German or Ukrainian; changing it reloads the app ---
function renderLangSetting() {
  const pref = store.get("lang", "auto");
  $("langIn").innerHTML = [["auto", tl("Automatic", "Automatisch", "Автоматично")], ["en", "English"], ["de", "Deutsch"], ["uk", "Українська"]]
    .map(([v, name]) => `<button role="radio" aria-checked="${v === pref}" data-v="${v}">${name}</button>`).join("");
}
$("langIn").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || b.dataset.v === store.get("lang", "auto")) return;
  store.set("lang", b.dataset.v);
  location.reload();
});
$("skyIn").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  S.limit = +b.dataset.v; store.set("limit", S.limit);
  S.passesAt = 0;   // which passes count as visible changes too
  renderSkySetting(); renderSheet(); updateStatus(); updateCard();
});

// --- quick guide: six short steps, each pointing at the button it explains ---
const GUIDE = [
  { title: tl("Point your phone at the sky", "Richte dein Handy auf den Himmel", "Наведи телефон на небо"), spot: [],
    text: tl("Hold your phone up like a window onto the sky. The satellites in that direction appear on screen. Gold dots are lit by the sun, and the bigger the dot, the brighter it looks. Blue dots are in Earth's shadow, so you can't see them.",
             "Halte dein Handy hoch wie ein Fenster zum Himmel. Die Satelliten in dieser Richtung erscheinen auf dem Bildschirm. Goldene Punkte werden von der Sonne angestrahlt, und je größer der Punkt, desto heller wirkt er. Blaue Punkte sind im Erdschatten, die kannst du nicht sehen.",
             "Тримай телефон перед собою, як віконце в небо. На екрані з’являються супутники в цьому напрямку. Золоті точки освітлює Сонце, і що більша точка, то яскравіший супутник. Сині точки в тіні Землі, тож їх не видно.") },
  { title: tl("Line up the compass", "Kompass ausrichten", "Вирівняй компас"), spot: ["alignBtn"],
    text: tl("Phone compasses are often a few degrees off. Tap ◎, center a bright star, planet or the Moon in the camera picture, and tap its name. Everything then lines up with the real sky.",
             "Handykompasse liegen oft ein paar Grad daneben. Tippe auf ◎, bring einen hellen Stern, Planeten oder den Mond in die Mitte des Kamerabilds und tippe auf seinen Namen. Dann passt alles zum echten Himmel.",
             "Компаси телефонів часто помиляються на кілька градусів. Торкнися ◎, наведи центр кадру камери на яскраву зорю, планету чи Місяць і торкнися назви. Тоді все збігатиметься зі справжнім небом.") },
  { title: tl("Tap a satellite", "Tippe einen Satelliten an", "Торкнися супутника"), spot: [],
    text: tl("Tap a dot to see where to look and what it is. Tap the card for who runs it, when it launched and its orbit, and tap ☆ to make it a favorite. Favorites are always labelled.",
             "Tippe auf einen Punkt, um zu sehen, wohin du schauen musst und was es ist. Tippe auf die Karte für Betreiber, Start und Umlaufbahn, und auf ☆, um ihn zum Favoriten zu machen. Favoriten sind immer beschriftet.",
             "Торкнися точки, щоб дізнатися, куди дивитися і що це таке. Торкнися картки, щоб побачити, хто керує супутником, коли його запустили і яка в нього орбіта, а ☆ додає його до обраного. Обрані супутники завжди підписані.") },
  { title: tl("Plan your night", "Plane deine Nacht", "Сплануй свою ніч"), spot: ["tabTonight", "tabSpace"],
    text: tl("Tonight shows when it gets dark, the clouds, the Moon and the best passes. Tap a pass to follow it: you get its path across the sky, a countdown, and a buzz when it rises. Space lists rocket launches and who is in space right now.",
             "„Nacht“ zeigt, wann es dunkel wird, die Wolken, den Mond und die besten Überflüge. Tippe einen Überflug an, um ihm zu folgen: Du bekommst seine Bahn über den Himmel, einen Countdown und ein Vibrieren, wenn er aufgeht. „Raumfahrt“ zeigt Raketenstarts und wer gerade im All ist.",
             "«Ніч» показує, коли стемніє, хмари, Місяць і найкращі прольоти. Торкнися прольоту, щоб стежити за ним: побачиш його шлях небом і зворотний відлік, а телефон завібрує, коли супутник зійде. «Космос» показує запуски ракет і хто зараз у космосі.") },
  { title: tl("Saw something move?", "Etwas Bewegtes gesehen?", "Щось рухалося в небі?"), spot: ["grab"],
    text: tl("Open the list and tap “Saw something moving?”. Point where you saw it, and the app finds out which satellite it was.",
             "Öffne die Liste und tippe auf „Etwas Bewegtes gesehen?“. Zeig dorthin, wo du es gesehen hast, und die App findet heraus, welcher Satellit es war.",
             "Відкрий список і торкнися «Щось рухалося в небі?». Покажи, де це було, і застосунок з’ясує, який це був супутник.") },
  { title: tl("A few more buttons", "Noch ein paar Tasten", "Ще кілька кнопок"), spot: ["globeBtn", "motionBtn", "camBtn", "timeBtn", "redBtn", "setBtn"],
    text: tl("On the right: the globe shows the whole Earth with every satellite, the phone button switches between following your phone and dragging the sky, and ◉ puts the camera picture behind the sky. ◷ shows the sky up to 12 hours ahead. R turns the screen red (tap again for dimmer) so your eyes stay used to the dark. ⚙ has your location, your horizon, and this guide.",
             "Rechts: Der Globus zeigt die ganze Erde mit allen Satelliten, die Handy-Taste schaltet um zwischen „dem Handy folgen“ und „den Himmel ziehen“, und ◉ legt das Kamerabild hinter den Himmel. ◷ zeigt den Himmel bis zu 12 Stunden im Voraus. R färbt den Bildschirm rot (noch einmal tippen für dunkler), damit deine Augen an die Dunkelheit gewöhnt bleiben. Unter ⚙ findest du deinen Standort, deinen Horizont und diese Anleitung.",
             "Праворуч: глобус показує всю Землю з усіма супутниками, кнопка з телефоном перемикає між стеженням за телефоном і перетягуванням неба, а ◉ підкладає під небо зображення з камери. ◷ показує небо на 12 годин уперед. R робить екран червоним (торкнися ще раз, щоб затемнити), щоб очі не відвикали від темряви. У ⚙ є твоє місцезнаходження, твій горизонт і ця інструкція.") },
];
let guideAt = 0;
function showGuideStep() {
  document.querySelectorAll(".spot").forEach(el => el.classList.remove("spot"));
  const g = GUIDE[guideAt];
  $("guideStep").textContent = tl(`${guideAt + 1} OF ${GUIDE.length}`, `${guideAt + 1} VON ${GUIDE.length}`, `${guideAt + 1} / ${GUIDE.length}`);
  $("guideTitle").textContent = g.title;
  $("guideText").textContent = g.text;
  $("guideNext").textContent = guideAt === GUIDE.length - 1 ? tl("Done", "Fertig", "Готово") : tl("Next", "Weiter", "Далі");
  g.spot.forEach(id => $(id).classList.add("spot"));
}
function openGuide() { guideAt = 0; $("guide").hidden = false; showGuideStep(); openLayer($("guide"), closeGuide, $("guideNext")); }
function closeGuide() {
  document.querySelectorAll(".spot").forEach(el => el.classList.remove("spot"));
  $("guide").hidden = true; closeLayer($("guide")); store.set("guideSeen", true);
}
$("guideNext").addEventListener("click", () => { if (++guideAt >= GUIDE.length) closeGuide(); else showGuideStep(); });
$("guideSkip").addEventListener("click", closeGuide);
$("guideBtn").addEventListener("click", () => { $("settings").hidden = true; closeLayer($("settings")); openGuide(); });

// --- settings ---
function updateLocNow() {
  $("locNow").innerHTML = S.loc
    ? `${esc(locName(S.loc) || tl("Custom coordinates", "Eigene Koordinaten", "Власні координати"))}<span class="sub">${fmtLatLon(S.loc.lat, S.loc.lon)}${S.loc.h ? ` · ${fmtN(Math.round(S.loc.h))} ${U.m}` : ""}</span>`
    : tl(`Not set yet<span class="sub">Search for your town below</span>`, `Noch nicht festgelegt<span class="sub">Suche unten nach deinem Ort</span>`, `Ще не вказано<span class="sub">Знайди своє місто нижче</span>`);
}
function updateTleInfo() {
  const n = S.counts, total = n.bright + n.starlink + n.other;
  $("cntBright").textContent = fmtN(n.bright);
  $("cntStarlink").textContent = fmtN(n.starlink);
  $("cntOther").textContent = fmtN(n.other);
  const when = S.tleTime ? tl(`, downloaded ${fmtDate(new Date(S.tleTime))} ${fmtTime(S.tleTime)}`, `, geladen am ${fmtDate(new Date(S.tleTime))} um ${fmtTime(S.tleTime)}`, `, завантажено ${fmtDate(new Date(S.tleTime))} о ${fmtTime(S.tleTime)}`) : "";
  $("tleInfo").textContent = total ? tl(`${fmtN(total)} satellites from CelesTrak${when}. Updates itself every 6 hours.`, `${fmtN(total)} Satelliten von CelesTrak${when}. Aktualisiert sich alle 6 Stunden.`, `${fmtN(total)} ${ukPlural(total, "супутник", "супутники", "супутників")} від CelesTrak${when}. Оновлюється кожні 6 годин.`)
    : tl("No satellite data yet.", "Noch keine Satellitendaten.", "Даних про супутники ще немає.");
}
function openSettings() {
  $("latIn").value = S.loc?.lat ?? ""; $("lonIn").value = S.loc?.lon ?? "";
  $("corrIn").value = S.corr; $("corrVal").textContent = (S.corr > 0 ? "+" : "") + S.corr + "°";
  $("showBright").checked = S.show.bright; $("showStarlink").checked = S.show.starlink; $("showOther").checked = S.show.other;
  $("eyeOnly").checked = S.eyeOnly;
  $("batteryIn").checked = S.battery;
  $("locErr").hidden = true; markCoords(false);
  updateLocNow(); updateTleInfo(); renderSkySetting(); renderSightNote(); renderTextSetting(); renderLangSetting();
  renderHorizonSetting(); renderPlaces(); renderInstall();
  $("settings").hidden = false;
  openLayer($("settings"), closeSettings, $("setDone"));
}
function closeSettings() {
  if (!S.loc) { $("locErr").textContent = tl("Choose a location first, so the app knows which part of the sky you see.", "Wähle zuerst einen Standort, damit die App weiß, welchen Teil des Himmels du siehst.", "Спершу вибери місцезнаходження, щоб застосунок знав, яку частину неба ти бачиш."); $("locErr").hidden = false; return; }
  disarmSightReset();
  $("settings").hidden = true; closeLayer($("settings"));
}
// Invalid coordinates are marked on both fields, which point to the error message below them.
const markCoords = bad => { for (const id of ["latIn", "lonIn"]) $(id).setAttribute("aria-invalid", bad); };
function setLocation(loc) {
  S.loc = loc; store.set("loc", loc);
  sendObs(); loadSkyline(); S.passes = null; S.passesAt = 0; S.passJob++;
  computeSky(); updateLocNow(); updateStatus(); renderSheet(); updateCard();
  if (!$("settings").hidden) { renderHorizonSetting(); renderPlaces(); }
}
$("setBtn").addEventListener("click", openSettings);
$("setDone").addEventListener("click", closeSettings);
$("corrIn").addEventListener("input", e => { S.corr = +e.target.value; $("corrVal").textContent = (S.corr > 0 ? "+" : "") + S.corr + "°"; store.set("corr", S.corr); });
$("eyeOnly").addEventListener("change", e => { S.eyeOnly = e.target.checked; store.set("eyeOnly", S.eyeOnly); renderSheet(); updateStatus(); });
$("batteryIn").addEventListener("change", e => { S.battery = e.target.checked; store.set("battery", S.battery); });
// Forgetting sightings can't be undone, so the button asks for a second tap within 5 seconds.
const sightResetLabel = $("sightReset").textContent;
function disarmSightReset() { const b = $("sightReset"); clearTimeout(b._timer); delete b.dataset.armed; b.textContent = sightResetLabel; }
$("sightReset").addEventListener("click", () => {
  const b = $("sightReset");
  if (!b.dataset.armed) {
    const n = sightingCount();
    b.dataset.armed = "1";
    b.textContent = tl(`Tap again to forget ${n} sighting${n === 1 ? "" : "s"}`, `Noch einmal tippen, um ${n} Sichtung${n === 1 ? "" : "en"} zu vergessen`, `Торкнися ще раз, щоб забути ${n} ${ukPlural(n, "спостереження", "спостереження", "спостережень")}`);
    clearTimeout(b._timer); b._timer = setTimeout(disarmSightReset, 5000);
    return;
  }
  disarmSightReset(); forgetSightings(); renderSightNote();
});
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
  box.innerHTML = `<p class="small">${tl("Searching…", "Suche…", "Пошук…")}</p>`;
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=${LANG}&format=json`, { signal: placeCtl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    placeList = (await r.json()).results || [];
    box.innerHTML = placeList.length ? placeList.map((p, i) => `
      <button class="place" data-i="${i}"><span>${esc(p.name)}</span>
      <span class="sub">${esc([p.admin1, p.country].filter(Boolean).join(", "))} · ${fmtLatLon(p.latitude, p.longitude)}</span></button>`).join("")
      : `<p class="small">${tl(`No places found for “${esc(q)}”. Try another spelling or a larger town nearby.`, `Keine Orte für „${esc(q)}“ gefunden. Versuche eine andere Schreibweise oder einen größeren Ort in der Nähe.`, `Нічого не знайдено за запитом «${esc(q)}». Спробуй інше написання або більше місто поблизу.`)}</p>`;
  } catch (e) {
    if (e.name !== "AbortError") box.innerHTML = `<p class="err">${tl("Couldn't search right now. Check your connection, or use GPS or coordinates instead.", "Die Suche klappt gerade nicht. Prüfe deine Verbindung oder nutze GPS oder Koordinaten.", "Зараз пошук не працює. Перевір з’єднання або скористайся GPS чи координатами.")}</p>`;
  }
}
$("placeResults").addEventListener("click", e => {
  const b = e.target.closest(".place"); if (!b) return;
  const p = placeList[+b.dataset.i];
  setLocation({ lat: +p.latitude.toFixed(4), lon: +p.longitude.toFixed(4), h: p.elevation || 0, name: [p.name, p.admin1 || p.country].filter(Boolean).join(", "), src: "search" });
  $("placeResults").innerHTML = ""; $("placeIn").value = ""; $("locErr").hidden = true;
});
$("gpsBtn").addEventListener("click", async () => {
  const b = $("gpsBtn"), label = b.textContent; b.textContent = tl("Finding you…", "Standort wird gesucht…", "Визначаю місцезнаходження…");
  try { const l = await getLocation(); setLocation({ ...l, name: GPS_NAME, src: "gps" }); $("locErr").hidden = true; }
  catch (e) { $("locErr").textContent = e.message; $("locErr").hidden = false; }
  b.textContent = label;
});
$("coordBtn").addEventListener("click", () => {
  const lat = parseFloat($("latIn").value), lon = parseFloat($("lonIn").value);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    $("locErr").textContent = tl("Latitude must be between -90 and 90, and longitude between -180 and 180.", "Der Breitengrad muss zwischen -90 und 90 liegen, der Längengrad zwischen -180 und 180.", "Широта має бути від -90 до 90, а довгота від -180 до 180."); $("locErr").hidden = false;
    markCoords(true); return;
  }
  setLocation({ lat, lon, h: 0, name: null, src: "manual" }); $("locErr").hidden = true; markCoords(false);
});
$("refreshBtn").addEventListener("click", async () => {
  const b = $("refreshBtn"), label = b.textContent; b.textContent = tl("Downloading…", "Wird geladen…", "Завантаження…"); b.disabled = true;
  await loadSats(true);
  b.textContent = label; b.disabled = false;
});
