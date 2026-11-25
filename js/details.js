// Overhead: The satellite details panel.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// --- details panel ---
function openDetails(id) {
  const sat = S.byId.get(id); if (!sat) return;
  if (S.targetId !== id) setTarget(id);
  S.detailsId = id;
  $("details").hidden = false; $("details").scrollTop = 0;
  $("detName").textContent = sat.name;
  updateFavButtons();
  const d = intlDesig(sat.l1);
  $("detChips").innerHTML = [`<span class="chip k">${esc(CAT_LABEL[sat.cat])}</span>`, `<span class="chip">NORAD ${fromAlpha5(sat.id)}</span>`, d ? `<span class="chip">${esc(d.code)}</span>` : ""].join("");
  const o = orbitInfo(sat), model = window.Model3D?.open($("model3d"), { name: sat.nameU, orbit: o && o.short });
  $("modelNote").textContent = !model ? "" : model.placeholder
    ? tl("There's no 3D model for this kind of satellite yet, so this is a placeholder cube.", "Für diese Art von Satellit gibt es noch kein 3D-Modell, daher ein Platzhalter-Würfel.")
    : simpleModelNote(model);
  offerDetailedModel(model && model.key);   // NASA's own model for the ISS and Hubble
  renderOrbit(sat); renderNow(sat); renderAbout(sat, catMem.has(id) ? null : "loading");
  catalog(sat).then(() => { if (S.detailsId === id) renderAbout(sat); }).catch(() => { if (S.detailsId === id) renderAbout(sat, "offline"); });
  $("detPasses").innerHTML = `<p class="small">Working out passes…</p>`;
  setTimeout(() => { if (S.detailsId === id) renderDetailPasses(sat); }, 30);
}
function closeDetails() { S.detailsId = null; $("details").hidden = true; window.Model3D?.stop(); closeDetailedModel(); }
$("detBack").addEventListener("click", closeDetails);
const simpleModelNote = m => tl(`Simplified model: ${m.title}. ${m.size}. Drag to turn it.`, `Vereinfachtes Modell: ${m.title}. ${m.size}. Zum Drehen ziehen.`);

function renderNow(sat) {
  $("detNowH").textContent = S.timeOffset ? tl(`At ${dayWord(simNow())} ${fmtTime(simNow())}`, `${cap(dayWord(simNow()))} um ${fmtTime(simNow())}`) : tl("Right now", "Gerade jetzt");
  const l = lookOne(sat, new Date(simNow()));
  if (!l) { $("detNow").innerHTML = rows([[tl("Position", "Position"), tl("Can't be worked out from the current data", "Mit den aktuellen Daten nicht berechenbar")]]); return; }
  const up = l.el != null && l.el > 0;
  $("detNow").innerHTML = rows([
    [tl("Where to look", "Wohin schauen"), l.el == null ? tl("Set your location first", "Lege zuerst deinen Standort fest")
      : up ? tl(`${compassName(l.az)} (${l.az.toFixed(0)}°), ${l.el.toFixed(0)}° above the horizon`, `${compassName(l.az)} (${l.az.toFixed(0)}°), ${l.el.toFixed(0)}° über dem Horizont`) : tl("Below your horizon", "Unter deinem Horizont")],
    [tl("Can you see it?", "Ist er zu sehen?"), up ? cap(visText(l.lit, l.mag)) : (l.lit ? tl("Sunlit, but below your horizon", "Angestrahlt, aber unter deinem Horizont") : tl("No, it's in Earth's shadow", "Nein, er ist im Erdschatten"))],
    [tl("Brightness", "Helligkeit"), up && l.lit && l.mag != null ? `Magnitude ${fmtN(l.mag, 1)}<span class="sub">${cap(brightWord(l.mag))}. ${tl("Estimated; lower is brighter.", "Geschätzt; kleiner ist heller.")}</span>` : null],
    [tl("Typical brightness", "Typische Helligkeit"), `Magnitude ${fmtN(sat.m0, 1)}<span class="sub">${tl("At 1,000 km away and half lit, the standard for comparing satellites.", "In 1.000 km Entfernung und halb beleuchtet, der Maßstab zum Vergleich von Satelliten.")} ${MAG_SOURCE[sat.m0src] || ""}.${sightingNote(sat)}</span>`],
    [tl("Distance from you", "Entfernung von dir"), l.range != null ? fmtKm(l.range) : null],
    [tl("Height above Earth", "Höhe über der Erde"), fmtKm(l.alt)],
    [tl("Speed", "Geschwindigkeit"), `${fmtN(l.speed, 2)} km/s <span class="sub">${fmtN(Math.round(l.speed * 3600))} km/h</span>`],
    [tl("Directly above", "Senkrecht über"), fmtLatLon(l.lat, l.lon)],
  ]);
}

function renderAbout(sat, state) {
  const op = operatorOf(sat), c = catMem.get(sat.id), d = intlDesig(sat.l1);
  const launch = c?.launch ? new Date(c.launch + "T00:00:00Z") : null;
  $("detAbout").innerHTML = rows([
    [tl("Operator", "Betreiber"), op?.op ? esc(op.op) : null],
    [tl("What it does", "Aufgabe"), op?.role ? esc(op.role) : null],
    [tl("Owner (country or organization)", "Eigentümer (Land oder Organisation)"), c ? esc(ownerName(c) || tl("Unknown", "Unbekannt")) : null],
    [tl("Launched", "Gestartet"), launch ? `${fmtDate(launch)} <span class="sub">${ago(launch)}</span>` : (d ? `${d.year}` : null)],
    [tl("Launch site", "Startplatz"), c?.site ? esc(CODES.SITES[c.site] || c.site) : null],
    [tl("Object type", "Objektart"), c?.type ? esc(CODES.TYPES[c.type] || c.type) : null],
    [tl("Status", "Status"), c?.status ? esc(STATUS[c.status] || tl("Unknown", "Unbekannt")) : null],
    [tl("Catalog", "Katalog"), state === "loading" ? tl("Looking up owner and launch details…", "Eigentümer und Startdaten werden nachgeschlagen…")
      : state === "offline" ? tl("Couldn't reach the satellite catalog. Check your connection and open this again.", "Der Satellitenkatalog ist nicht erreichbar. Prüfe deine Verbindung und öffne dies erneut.") : null],
  ]);
}

function renderOrbit(sat) {
  const o = orbitInfo(sat);
  if (!o) { $("detOrbit").innerHTML = rows([[tl("Orbit", "Bahn"), tl("No usable orbit data", "Keine brauchbaren Bahndaten")]]); return; }
  const height = Math.abs(o.apo - o.peri) < 40 ? `${tl("About", "Etwa")} ${fmtKm((o.apo + o.peri) / 2)}` : `${fmtKm(o.peri)} ${tl("to", "bis")} ${fmtKm(o.apo)}`;
  const period = o.period >= 120 ? `${Math.floor(o.period / 60)} h ${Math.round(o.period % 60)} min` : `${fmtN(o.period, 1)} ${tl("minutes", "Minuten")}`;
  const reach = (o.inc <= 90 ? o.inc : 180 - o.inc).toFixed(0);
  const epoch = tleEpoch(sat.l1);
  $("detOrbit").innerHTML = rows([
    [tl("Orbit type", "Bahntyp"), `${esc(o.cls)}<span class="sub">${esc(o.note)}</span>`],
    [tl("Height", "Höhe"), height],
    [tl("Time for one orbit", "Dauer einer Umrundung"), `${period}<span class="sub">${fmtN(o.perDay, 1)} ${tl("orbits a day", "Umrundungen pro Tag")}</span>`],
    [tl("Inclination", "Bahnneigung"), `${fmtN(o.inc, 1)}°<span class="sub">${tl(`${o.inc > 90 ? "Retrograde, " : ""}passes over latitudes up to ${reach}° N and S`, `${o.inc > 90 ? "Rückläufig, " : ""}überfliegt Breiten bis ${reach}° Nord und Süd`)}</span>`],
    [tl("Eccentricity", "Exzentrizität"), `${fmtN(o.e, 4)}<span class="sub">${tl("0 is a perfect circle", "0 ist ein perfekter Kreis")}</span>`],
    [tl("Orbit data from", "Bahndaten vom"), `${fmtDate(epoch)}<span class="sub">${ago(epoch)}</span>`],
  ]);
}

function renderDetailPasses(sat) {
  const box = $("detPasses");
  if (!S.loc) { box.innerHTML = `<p class="small">${tl("Set your location in Settings to see passes.", "Lege in den Einstellungen deinen Standort fest, um Überflüge zu sehen.")}</p>`; return; }
  const o = orbitInfo(sat);
  if (o && o.short === "GEO") {
    const l = lookOne(sat, new Date(simNow()));
    box.innerHTML = `<p class="small">${l && l.el > 0
      ? tl(`It stays at about ${l.el.toFixed(0)}° up in the ${compassName(l.az)} and doesn't rise or set. You'll need binoculars or a telescope to spot it.`,
           `Er steht immer etwa ${l.el.toFixed(0)}° hoch im ${compassName(l.az)} und geht weder auf noch unter. Um ihn zu entdecken, brauchst du ein Fernglas oder Teleskop.`)
      : tl("It never rises above your horizon from where you are.", "Von deinem Standort aus steigt er nie über den Horizont.")}</p>`;
    return;
  }
  const list = passesFor(sat).filter(p => p.end > Date.now()).slice(0, 6);
  S.detailPasses = { sat, list };
  box.innerHTML = list.length ? `<p class="small">${tl("Tap a pass to follow it on the sky.", "Tippe einen Überflug an, um ihm am Himmel zu folgen.")}</p>` + list.map((p, i) => `
    <button class="passrow ${p.visible ? "lit" : ""}" data-i="${i}">
      <span class="dot"></span>
      <span>${fmtDayTime(p.start)}<span class="sub">${compassName(p.startAz)} → ${compassName(p.endAz)} · ${tl(`peak ${p.maxEl.toFixed(0)}° at ${fmtTime(p.maxTime)}`, `bis ${p.maxEl.toFixed(0)}° um ${fmtTime(p.maxTime)}`)}</span></span>
      <span class="num">${Math.max(1, Math.round((p.end - p.start) / 60000))} min<span class="sub">${p.visible ? `${tl("visible", "sichtbar")}, ${magText(p.mag)}` : p.mag < 50 ? `${tl("too faint", "zu schwach")}, ${magText(p.mag)}` : tl("not visible", "nicht sichtbar")}</span></span>
    </button>`).join("") : `<p class="small">${tl("No passes above 10° in the next 48 hours.", "Keine Überflüge über 10° in den nächsten 48 Stunden.")}</p>`;
}
$("detPasses").addEventListener("click", e => {
  const b = e.target.closest(".passrow"), d = S.detailPasses;
  if (b && d && d.list[+b.dataset.i]) watchPass(d.sat, d.list[+b.dataset.i]);
});
