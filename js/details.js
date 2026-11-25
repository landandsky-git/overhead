// Overhead: The satellite details panel.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// --- details panel ---
function openDetails(id) {
  const sat = S.byId.get(id); if (!sat) return;
  if (S.targetId !== id) setTarget(id);
  S.detailsId = id;
  $("details").hidden = false; $("details").scrollTop = 0;
  openLayer($("details"), closeDetails, $("detBack"));
  $("detName").textContent = sat.name;
  updateFavButtons();
  const d = intlDesig(sat.l1);
  $("detChips").innerHTML = [`<span class="chip k">${esc(CAT_LABEL[sat.cat])}</span>`, `<span class="chip">NORAD ${fromAlpha5(sat.id)}</span>`, d ? `<span class="chip">${esc(d.code)}</span>` : ""].join("");
  const o = orbitInfo(sat), model = window.Model3D?.open($("model3d"), { name: sat.nameU, orbit: o && o.short });
  $("modelNote").textContent = !model ? "" : model.placeholder
    ? tl("There's no 3D model for this kind of satellite yet, so this is a placeholder cube.", "Für diese Art von Satellit gibt es noch kein 3D-Modell, daher ein Platzhalter-Würfel.", "Для цього типу супутників ще немає 3D-моделі, тож це куб-заглушка.")
    : simpleModelNote(model);
  offerDetailedModel(model && model.key);   // NASA's own model for the ISS and Hubble
  renderOrbit(sat); renderNow(sat); renderAbout(sat, catMem.has(id) ? null : "loading");
  catalog(sat).then(() => { if (S.detailsId === id) renderAbout(sat); }).catch(() => { if (S.detailsId === id) renderAbout(sat, "offline"); });
  $("detPasses").innerHTML = `<p class="small">Working out passes…</p>`;
  setTimeout(() => { if (S.detailsId === id) renderDetailPasses(sat); }, 30);
}
function closeDetails() { S.detailsId = null; $("details").hidden = true; window.Model3D?.stop(); closeDetailedModel(); closeLayer($("details")); }
$("detBack").addEventListener("click", closeDetails);
const simpleModelNote = m => tl(`Simplified model: ${m.title}. ${m.size}. Drag to turn it.`, `Vereinfachtes Modell: ${m.title}. ${m.size}. Zum Drehen ziehen.`, `Спрощена модель: ${m.title}. ${m.size}. Перетягни, щоб обертати.`);

function renderNow(sat) {
  $("detNowH").textContent = S.timeOffset ? tl(`At ${dayWord(simNow())} ${fmtTime(simNow())}`, `${cap(dayWord(simNow()))} um ${fmtTime(simNow())}`, `${cap(dayWord(simNow()))} о ${fmtTime(simNow())}`) : tl("Right now", "Gerade jetzt", "Саме зараз");
  const l = lookOne(sat, new Date(simNow()));
  if (!l) { $("detNow").innerHTML = rows([[tl("Position", "Position", "Положення"), tl("Can't be worked out from the current data", "Mit den aktuellen Daten nicht berechenbar", "Не вдається розрахувати з поточних даних")]]); return; }
  const up = l.el != null && l.el > 0;
  $("detNow").innerHTML = rows([
    [tl("Where to look", "Wohin schauen", "Куди дивитися"), l.el == null ? tl("Set your location first", "Lege zuerst deinen Standort fest", "Спершу вкажи місцезнаходження")
      : up ? tl(`${compassName(l.az)} (${l.az.toFixed(0)}°), ${l.el.toFixed(0)}° above the horizon`, `${compassName(l.az)} (${l.az.toFixed(0)}°), ${l.el.toFixed(0)}° über dem Horizont`, `${compassName(l.az)} (${l.az.toFixed(0)}°), ${l.el.toFixed(0)}° над горизонтом`) : tl("Below your horizon", "Unter deinem Horizont", "Під твоїм горизонтом")],
    [tl("Can you see it?", "Ist er zu sehen?", "Чи його видно?"), up ? cap(visText(l.lit, l.mag)) : (l.lit ? tl("Sunlit, but below your horizon", "Angestrahlt, aber unter deinem Horizont", "Освітлений Сонцем, але під твоїм горизонтом") : tl("No, it's in Earth's shadow", "Nein, er ist im Erdschatten", "Ні, він у тіні Землі"))],
    [tl("Brightness", "Helligkeit", "Яскравість"), up && l.lit && l.mag != null ? `${tl("Magnitude", "Magnitude", "Зоряна величина")} ${fmtN(l.mag, 1)}<span class="sub">${cap(brightWord(l.mag))}. ${tl("Estimated; lower is brighter.", "Geschätzt; kleiner ist heller.", "Оцінка; що менше число, то яскравіше.")}</span>` : null],
    [tl("Typical brightness", "Typische Helligkeit", "Типова яскравість"), `${tl("Magnitude", "Magnitude", "Зоряна величина")} ${fmtN(sat.m0, 1)}<span class="sub">${tl("At 1,000 km away and half lit, the standard for comparing satellites.", "In 1.000 km Entfernung und halb beleuchtet, der Maßstab zum Vergleich von Satelliten.", "На відстані 1 000 км і освітлений наполовину: стандарт для порівняння супутників.")} ${MAG_SOURCE[sat.m0src] || ""}.${sightingNote(sat)}</span>`],
    [tl("Distance from you", "Entfernung von dir", "Відстань від тебе"), l.range != null ? fmtKm(l.range) : null],
    [tl("Height above Earth", "Höhe über der Erde", "Висота над Землею"), fmtKm(l.alt)],
    [tl("Speed", "Geschwindigkeit", "Швидкість"), `${fmtN(l.speed, 2)} ${U.kms} <span class="sub">${fmtN(Math.round(l.speed * 3600))} ${U.kmh}</span>`],
    [tl("Directly above", "Senkrecht über", "Прямо над"), fmtLatLon(l.lat, l.lon)],
  ]);
}

function renderAbout(sat, state) {
  const op = operatorOf(sat), c = catMem.get(sat.id), d = intlDesig(sat.l1);
  const launch = c?.launch ? new Date(c.launch + "T00:00:00Z") : null;
  $("detAbout").innerHTML = rows([
    [tl("Operator", "Betreiber", "Оператор"), op?.op ? esc(op.op) : null],
    [tl("What it does", "Aufgabe", "Призначення"), op?.role ? esc(op.role) : null],
    [tl("Owner (country or organization)", "Eigentümer (Land oder Organisation)", "Власник (країна чи організація)"), c ? esc(ownerName(c) || tl("Unknown", "Unbekannt", "Невідомо")) : null],
    [tl("Launched", "Gestartet", "Запущено"), launch ? `${fmtDate(launch)} <span class="sub">${ago(launch)}</span>` : (d ? `${d.year}` : null)],
    [tl("Launch site", "Startplatz", "Місце запуску"), c?.site ? esc(CODES.SITES[c.site] || c.site) : null],
    [tl("Object type", "Objektart", "Тип об’єкта"), c?.type ? esc(CODES.TYPES[c.type] || c.type) : null],
    [tl("Status", "Status", "Статус"), c?.status ? esc(STATUS[c.status] || tl("Unknown", "Unbekannt", "Невідомо")) : null],
    [tl("Catalog", "Katalog", "Каталог"), state === "loading" ? tl("Looking up owner and launch details…", "Eigentümer und Startdaten werden nachgeschlagen…", "Шукаю власника й дані про запуск…")
      : state === "offline" ? tl("Couldn't reach the satellite catalog. Check your connection and open this again.", "Der Satellitenkatalog ist nicht erreichbar. Prüfe deine Verbindung und öffne dies erneut.", "Каталог супутників недоступний. Перевір з’єднання й відкрий це ще раз.") : null],
  ]);
}

function renderOrbit(sat) {
  const o = orbitInfo(sat);
  if (!o) { $("detOrbit").innerHTML = rows([[tl("Orbit", "Bahn", "Орбіта"), tl("No usable orbit data", "Keine brauchbaren Bahndaten", "Немає придатних даних про орбіту")]]); return; }
  const height = Math.abs(o.apo - o.peri) < 40 ? `${tl("About", "Etwa", "Близько")} ${fmtKm((o.apo + o.peri) / 2)}` : `${fmtKm(o.peri)} ${tl("to", "bis", "до")} ${fmtKm(o.apo)}`;
  const period = o.period >= 120 ? `${Math.floor(o.period / 60)} ${U.h} ${Math.round(o.period % 60)} ${U.min}` : `${fmtN(o.period, 1)} ${tl("minutes", "Minuten", "хв")}`;
  const reach = (o.inc <= 90 ? o.inc : 180 - o.inc).toFixed(0);
  const epoch = tleEpoch(sat.l1);
  $("detOrbit").innerHTML = rows([
    [tl("Orbit type", "Bahntyp", "Тип орбіти"), `${esc(o.cls)}<span class="sub">${esc(o.note)}</span>`],
    [tl("Height", "Höhe", "Висота"), height],
    [tl("Time for one orbit", "Dauer einer Umrundung", "Час одного оберту"), `${period}<span class="sub">${fmtN(o.perDay, 1)} ${tl("orbits a day", "Umrundungen pro Tag", "обертів на добу")}</span>`],
    [tl("Inclination", "Bahnneigung", "Нахил орбіти"), `${fmtN(o.inc, 1)}°<span class="sub">${tl(`${o.inc > 90 ? "Retrograde, " : ""}passes over latitudes up to ${reach}° N and S`, `${o.inc > 90 ? "Rückläufig, " : ""}überfliegt Breiten bis ${reach}° Nord und Süd`, `${o.inc > 90 ? "Зворотний рух, " : ""}пролітає над широтами до ${reach}° пн. і пд.`)}</span>`],
    [tl("Eccentricity", "Exzentrizität", "Ексцентриситет"), `${fmtN(o.e, 4)}<span class="sub">${tl("0 is a perfect circle", "0 ist ein perfekter Kreis", "0 — ідеальне коло")}</span>`],
    [tl("Orbit data from", "Bahndaten vom", "Дані орбіти від"), `${fmtDate(epoch)}<span class="sub">${ago(epoch)}</span>`],
  ]);
}

function renderDetailPasses(sat) {
  const box = $("detPasses");
  if (!S.loc) { box.innerHTML = `<p class="small">${tl("Set your location in Settings to see passes.", "Lege in den Einstellungen deinen Standort fest, um Überflüge zu sehen.", "Вкажи місцезнаходження в налаштуваннях, щоб побачити прольоти.")}</p>`; return; }
  const o = orbitInfo(sat);
  if (o && o.short === "GEO") {
    const l = lookOne(sat, new Date(simNow()));
    box.innerHTML = `<p class="small">${l && l.el > 0
      ? tl(`It stays at about ${l.el.toFixed(0)}° up in the ${compassName(l.az)} and doesn't rise or set. You'll need binoculars or a telescope to spot it.`,
           `Er steht immer etwa ${l.el.toFixed(0)}° hoch im ${compassName(l.az)} und geht weder auf noch unter. Um ihn zu entdecken, brauchst du ein Fernglas oder Teleskop.`,
           `Він завжди приблизно на ${l.el.toFixed(0)}° над горизонтом на ${compassName(l.az)} і не сходить і не заходить. Щоб його побачити, знадобиться бінокль або телескоп.`)
      : tl("It never rises above your horizon from where you are.", "Von deinem Standort aus steigt er nie über den Horizont.", "З твого місця він ніколи не піднімається над горизонтом.")}</p>`;
    return;
  }
  const list = passesFor(sat).filter(p => p.end > Date.now()).slice(0, 6);
  S.detailPasses = { sat, list };
  box.innerHTML = list.length ? `<p class="small">${tl("Tap a pass to follow it on the sky. In each graph the line is its height above the horizon and the bars show how bright it is: gold while you can see it.",
                                                         "Tippe einen Überflug an, um ihm am Himmel zu folgen. In jeder Grafik zeigt die Linie die Höhe über dem Horizont und die Balken die Helligkeit: golden, solange du ihn sehen kannst.",
                                                         "Торкнися прольоту, щоб стежити за ним на небі. На кожному графіку лінія — висота над горизонтом, а стовпчики — яскравість: золоті, доки його видно.")}</p>` + list.map((p, i) => `
    <button class="passrow ${p.visible ? "lit" : ""}" data-i="${i}">
      <span class="dot"></span>
      <span>${fmtDayTime(p.start)}<span class="sub">${compassName(p.startAz)} → ${compassName(p.endAz)} · ${tl(`peak ${p.maxEl.toFixed(0)}° at ${fmtTime(p.maxTime)}`, `bis ${p.maxEl.toFixed(0)}° um ${fmtTime(p.maxTime)}`, `до ${p.maxEl.toFixed(0)}° о ${fmtTime(p.maxTime)}`)}</span>${passGraph(sat, p)}</span>
      <span class="num">${Math.max(1, Math.round((p.end - p.start) / 60000))} ${U.min}<span class="sub">${p.blocked ? tl("behind obstacles", "hinter Hindernissen", "за перешкодами") : p.visible ? `${tl("visible", "sichtbar", "видно")}, ${magText(p.mag)}` : p.mag < 50 ? `${tl("too faint", "zu schwach", "заслабкий")}, ${magText(p.mag)}` : tl("not visible", "nicht sichtbar", "не видно")}</span></span>
    </button>`).join("") : `<p class="small">${tl("No passes above 10° in the next 48 hours.", "Keine Überflüge über 10° in den nächsten 48 Stunden.", "Немає прольотів вище 10° у найближчі 48 годин.")}</p>`;
}
// A small graph of one pass. The line is its height above the horizon (the top is straight up); the
// bars show how bright it is while sunlit in a dark sky, taller for brighter: gold while it is bright
// enough for your sky, grey while too faint. Nothing while it is behind your trees or rooftops.
function passGraph(sat, p) {
  const pts = passProfile(sat, p, 40), W = 132, H = 30, L = p.limit ?? limitNow();
  if (pts.length < 2) return "";
  const x = k => (k / (pts.length - 1) * (W - 2) + 1).toFixed(1);
  const line = pts.map((q, k) => `${x(k)},${(H - 1 - q.el / 90 * (H - 2)).toFixed(1)}`).join(" ");
  let bright = "", faint = "";
  pts.forEach((q, k) => {
    if (q.mag == null || !q.dark || q.hidden) return;
    const h = Math.max(1, Math.min(H - 2, (L + 2 - q.mag) / 8 * (H - 2)));   // 2 magnitudes too faint: nothing; 6 brighter than needed: full
    const bar = `M${x(k)} ${H - 1}v${(-h).toFixed(1)}`;
    if (q.mag <= L) bright += bar; else faint += bar;
  });
  return `<svg class="pgraph" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><path class="pg-faint" d="${faint}"/><path class="pg-bright" d="${bright}"/><polyline class="pg-el" points="${line}"/></svg>`;
}
$("detPasses").addEventListener("click", e => {
  const b = e.target.closest(".passrow"), d = S.detailPasses;
  if (b && d && d.list[+b.dataset.i]) watchPass(d.sat, d.list[+b.dataset.i]);
});
