// Overhead: The pull-up lists: now, tonight, passes and favorites.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// --- sheet: what's up now, search, passes ---
function satRow(sat, extraClass) {
  const n = S.nowMap.get(sat.idx), up = n && n.el > 0;
  const cls = `row ${up ? (n.lit ? "lit" : "") : "down"} ${sat.id === S.targetId ? "sel" : ""} ${extraClass || ""}`;
  const right = up ? `${compassName(n.az)} ${n.az.toFixed(0)}°<span class="sub">${n.el.toFixed(0)}° up</span>` : `<span class="sub">below horizon</span>`;
  const np = !up && isFav(sat) && S.loc ? nextPass(sat) : null;
  const sub = up ? `${n.lit ? magText(n.mag) : "in shadow"} · ${fmtKm(n.range)}`
    : np ? `rises ${fmtDayTime(np.start)} in the ${compassName(np.startAz)}${np.visible ? " (visible)" : ""}`
    : isFav(sat) && S.loc ? "doesn't rise above 10° here in the next 2 days" : `${CAT_LABEL[sat.cat]} · #${sat.id}`;
  return `<button class="${cls}" data-id="${sat.id}"><span class="dot"></span><span class="nm">${esc(favName(sat))}<span class="sub">${sub}</span></span><span class="num">${right}</span></button>`;
}

function renderSheet() {
  const box = $("listBox");
  $("tabNow").setAttribute("aria-selected", S.tab === "now");
  $("tabTonight").setAttribute("aria-selected", S.tab === "tonight");
  $("tabPasses").setAttribute("aria-selected", S.tab === "passes");
  $("nowTools").hidden = S.tab !== "now";
  const body = $("sheetBody"), top = body.scrollTop;
  if (S.tab === "tonight") {
    renderTonight(box);
  } else if (S.tab === "now") {
    const q = $("findIn").value.trim();
    const up = visibleNow();
    $("sheetTitle").textContent = `${upTitle()} · ${up.length.toLocaleString("en")}`;
    if (q) {
      const Q = q.toUpperCase(), hits = [];
      for (const s of S.sats) { if (s.nameU.includes(Q) || s.id === q || String(fromAlpha5(s.id)) === q) { hits.push(s); if (hits.length >= 60) break; } }
      hits.sort((a, b) => ((S.nowMap.get(b.idx)?.el ?? -99) > 0) - ((S.nowMap.get(a.idx)?.el ?? -99) > 0));
      box.innerHTML = hits.length ? hits.map(s => satRow(s)).join("") + (hits.length >= 60 ? `<div class="note">Showing the first 60 matches. Type more of the name to narrow it down.</div>` : "")
        : `<div class="empty">No satellite matches "${esc(q)}".</div>`;
    } else if (!up.length) {
      box.innerHTML = `<div class="empty">${S.sats.length ? (S.loc ? "Nothing is above the horizon right now. Check which satellite types are switched on in Settings." : "Set your location in Settings to see what's overhead.") : "Loading satellite data…"}</div>`;
    } else {
      const list = up.slice().sort((a, b) => (b.lit - a.lit) || (a.lit ? a.mag - b.mag : b.el - a.el));
      const shown = list.slice(0, 100);
      const favs = [...S.favs].map(id => S.byId.get(id)).filter(Boolean);
      box.innerHTML = (favs.length ? `<h4 class="tn-h">Favorites</h4>` + favs.map(sat => satRow(sat)).join("") + `<h4 class="tn-h">Up now</h4>` : "") +
        `<div class="legend"><span class="l">Sunlit, brightest first</span><span>In Earth's shadow</span></div>` +
        `<div class="note">Lower magnitude means brighter. Magnitude 6 is about the faintest you can see by eye in a dark sky.</div>` +
        shown.map(e => satRow(e.sat)).join("") +
        (list.length > shown.length ? `<div class="note">Showing 100 of ${list.length.toLocaleString("en")} satellites above the horizon. Search above to find a specific one.</div>` : "");
    }
  } else {
    $("sheetTitle").textContent = "Next 14 hours";
    if (!S.passes) { box.innerHTML = `<div class="empty">${S.loc ? "Working out passes…" : "Set your location in Settings first."}</div>`; }
    else {
      const list = S.passes.filter(p => p.end > Date.now()).slice(0, 60);
      S.passRows = list;
      box.innerHTML = `<div class="legend"><span class="l">Visible pass (sunlit, dark sky)</span><span>Not visible</span></div>` +
        `<div class="note">Bright satellites, space stations and new Starlink trains passing above 15°. Tap any satellite to see its own passes.</div>` +
        (list.length ? list.map((p, i) => `
        <button class="row ${p.visible ? "lit" : ""} ${p.sat.id === S.targetId ? "sel" : ""}" data-id="${p.sat.id}" data-pass="passes:${i}">
          <span class="dot"></span>
          <span class="nm">${esc(favName(p.sat))}<span class="sub">${compassName(p.startAz)} → ${compassName(p.endAz)} · peak ${p.maxEl.toFixed(0)}°${p.visible ? ` · ${magText(p.mag)}` : ""}</span></span>
          <span class="num">${fmtTime(p.start)}<span class="sub">${dayWord(p.start)} · ${Math.max(1, Math.round((p.end - p.start) / 60000))} min</span></span>
        </button>`).join("") : `<div class="empty">No passes above 15° in the next 12 hours.</div>`);
    }
  }
  body.scrollTop = top;
}

$("listBox").addEventListener("click", e => {
  const cal = e.target.closest(".cal");
  if (cal) { const p = S.tonightList?.[+cal.dataset.i]; if (p) addToCalendar(p); return; }
  const b = e.target.closest(".row");
  if (!b) return;
  // a pass: follow it on the sky; a satellite: open its details
  const [list, i] = (b.dataset.pass || "").split(":"), p = list && (list === "tonight" ? S.tonightList : S.passRows)?.[+i];
  if (p) watchPass(p.sat, p); else openDetails(b.dataset.id);
});
$("tabTonight").addEventListener("click", () => { S.tab = "tonight"; $("sheet").classList.add("open"); renderSheet(); sheetH(); });
$("findIn").addEventListener("input", () => { clearTimeout(renderSheet.t); renderSheet.t = setTimeout(renderSheet, 150); });
$("grab").addEventListener("click", () => { $("sheet").classList.toggle("open"); sheetH(); });
$("tabNow").addEventListener("click", () => { S.tab = "now"; $("sheet").classList.add("open"); renderSheet(); sheetH(); });
$("tabPasses").addEventListener("click", () => { S.tab = "passes"; $("sheet").classList.add("open"); renderSheet(); sheetH(); });
$("card").addEventListener("click", () => { if (S.targetId) openDetails(S.targetId); });
$("card").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && S.targetId) { e.preventDefault(); openDetails(S.targetId); } });
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
  if (S.targetId) { $("cardFav").textContent = on(S.targetId) ? "★" : "☆"; $("cardFav").setAttribute("aria-pressed", on(S.targetId)); $("cardFav").setAttribute("aria-label", on(S.targetId) ? "Remove from favorites" : "Add to favorites"); }
  if (S.detailsId) { $("detFav").textContent = on(S.detailsId) ? "★ Favorite" : "☆ Add to favorites"; $("detFav").setAttribute("aria-pressed", on(S.detailsId)); }
}
function sheetH() { document.documentElement.style.setProperty("--sheet-h", $("sheet").offsetHeight + "px"); }

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
function cloudWord(c) { return c < 20 ? "Clear" : c < 45 ? "Partly cloudy" : c < 75 ? "Mostly cloudy" : "Overcast"; }

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
const passTitle = p => p.count > 1 ? `Starlink train · ${p.count} satellites` : favName(p.sat);

function renderTonight(box) {
  $("sheetTitle").textContent = "Tonight";
  if (!S.loc) { box.innerHTML = `<div class="empty">Set your location in Settings first.</div>`; return; }
  const win = nightWindow();
  if (!win) { box.innerHTML = `<div class="empty">It doesn't get dark enough tonight to see satellites: the Sun stays less than 6° below the horizon.</div>`; return; }
  if (!cloudsFresh()) loadClouds();

  // clouds, hour by hour through the dark hours
  const hours = [];
  for (let t = Math.floor(win.start / 3600e3) * 3600e3; t < win.end; t += 3600e3) hours.push([t, cloudAt(t)]);
  const known = hours.filter(h => h[1] != null);
  let cloudHtml;
  if (!known.length) cloudHtml = `<div class="tn-line"><span class="tn-k">Clouds</span><span>${cloudsLoading ? "Checking the forecast…" : "No forecast available (offline?)"}</span></div>`;
  else {
    const avg = known.reduce((s, h) => s + h[1], 0) / known.length;
    let best = null, run = null;   // longest stretch under 40% cloud
    for (const [t, c] of hours) {
      if (c != null && c < 40) { run = run ? { ...run, to: t + 3600e3 } : { from: t, to: t + 3600e3 }; if (!best || run.to - run.from > best.to - best.from) best = run; }
      else run = null;
    }
    const clearNote = best && avg >= 20 ? ` · clearest ${fmtTime(Math.max(best.from, win.start))}–${fmtTime(Math.min(best.to, win.end))}` : "";
    cloudHtml = `<div class="tn-line"><span class="tn-k">Clouds</span><span>${cloudWord(avg)} (${Math.round(avg)}%)${clearNote}</span></div>
      <div class="tn-line"><span></span><div class="clouds" style="grid-template-columns: repeat(${hours.length}, minmax(0, 1fr))" aria-label="Cloud cover by hour">${hours.map(([t, c]) =>
        `<div class="cc" title="${fmtTime(t)}: ${c ?? "?"}% cloud"><b><span style="opacity:${c == null ? 0 : (c / 100).toFixed(2)}"></span></b><i>${new Date(t).getHours() % 3 === 0 ? fmtTime(t).replace(/:00(?!\d)/, "") : ""}</i></div>`).join("")}</div></div>`;
  }

  // the Moon: a bright Moon washes out faint satellites
  const mt = moonTonight(win), lit = sky.moon ? Math.round(sky.moon.lit * 100) : null;
  const moonWhen = mt.share === 0 ? "below the horizon all night" : mt.share === 1 ? "up all night"
    : [mt.rise && `rises ${fmtTime(mt.rise)}`, mt.set && `sets ${fmtTime(mt.set)}`].filter(Boolean).join(", ");
  const moonNote = lit != null && lit > 60 && mt.share > 0.4 ? ". Its light hides fainter satellites" : "";

  const list = tonightPasses(win);
  S.tonightList = list;
  const passHtml = !list ? `<div class="empty">Working out tonight's passes…</div>`
    : !list.length ? `<div class="empty">No bright passes in the dark hours tonight. Check the Passes tab for fainter ones.</div>`
    : list.map((p, i) => {
        const cc = cloudAt(p.maxTime), mins = Math.max(1, Math.round((p.end - p.start) / 60000));
        const sub = `${compassName(p.startAz)} → ${compassName(p.endAz)} · highest ${p.maxEl.toFixed(0)}° in the ${compassName(p.maxAz)} · ${magText(p.mag)}, ${brightWord(p.mag, p.limit)}` +
          (p.count > 1 ? ` · launch ${p.launch}` : "") + (cc != null && cc >= 60 ? ` · ${cc}% cloud` : "");
        return `<div class="pass">
          <button class="row lit ${p.sat.id === S.targetId ? "sel" : ""}" data-id="${p.sat.id}" data-pass="tonight:${i}"><span class="dot"></span>
            <span class="nm">${esc(passTitle(p))}<span class="sub tn-wrap">${sub}</span></span>
            <span class="num">${fmtTime(p.start)}<span class="sub">${dayWord(p.start)} · ${mins} min</span></span></button>
          <button class="cal" data-i="${i}">Add to calendar</button></div>`;
      }).join("");

  box.innerHTML = `<div class="tonight">
      <div class="tn-line"><span class="tn-k">Dark</span><span>${win.darkNow ? "Now" : fmtDayTime(win.start)} until ${fmtTime(win.end)}</span></div>
      ${cloudHtml}
      <div class="tn-line"><span class="tn-k">Seeing</span><span>${win.darkNow ? "Now" : `From ${fmtTime(win.start + 3600e3)}`} ${seeingText(conditionsAt(win.darkNow ? Date.now() : win.start + 3600e3))}</span></div>
      <div class="tn-line"><span class="tn-k">Moon</span><span>${lit != null ? `${lit}% lit, ` : ""}${moonWhen}${moonNote}</span></div>
    </div>
    <h4 class="tn-h">Best passes</h4>${passHtml}`;
}

// A calendar file for one pass, with a reminder 10 minutes before.
const icsTime = ms => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = s => String(s).replace(/[\\;,]/g, m => "\\" + m).replace(/\n/g, "\\n");
const icsFold = line => line.length <= 73 ? line : line.match(/.{1,73}/g).join("\r\n ");
function addToCalendar(p) {
  const title = p.count > 1 ? `Starlink train (${p.count} satellites)` : `${p.sat.name} pass`;
  const desc = `Rises in the ${compassName(p.startAz)} at ${fmtTime(p.start)}, highest (${p.maxEl.toFixed(0)}°) in the ${compassName(p.maxAz)} at ${fmtTime(p.maxTime)}, gone in the ${compassName(p.endAz)} by ${fmtTime(p.end)}. Brightness about magnitude ${p.mag.toFixed(1)} (${brightWord(p.mag, p.limit)}).`;
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Overhead//Satellite pass//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${p.sat.id}-${p.start}@overhead`, `DTSTAMP:${icsTime(Date.now())}`, `DTSTART:${icsTime(p.start - 60e3)}`, `DTEND:${icsTime(p.end + 60e3)}`,
    `SUMMARY:${icsText(title)}`, `DESCRIPTION:${icsText(desc)}`, S.loc?.name ? `LOCATION:${icsText(S.loc.name)}` : "",
    "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", `DESCRIPTION:${icsText(title)} in 10 minutes`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"].filter(Boolean).map(icsFold).join("\r\n");
  const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (iOS) { location.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(ics); return; }   // Safari offers "Add to Calendar"
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `${title.replace(/[^\w]+/g, "-").replace(/-+$/, "").toLowerCase()}-${new Date(p.start).toISOString().slice(0, 10)}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  showHint("Calendar file saved. Open it to add the pass, with a reminder 10 minutes before.", 6000);
}
