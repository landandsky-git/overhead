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
    ? "There's no 3D model for this kind of satellite yet, so this is a placeholder cube."
    : `Simplified model: ${model.title}. ${model.size}. Drag to turn it.`;
  renderOrbit(sat); renderNow(sat); renderAbout(sat, catMem.has(id) ? null : "loading");
  catalog(sat).then(() => { if (S.detailsId === id) renderAbout(sat); }).catch(() => { if (S.detailsId === id) renderAbout(sat, "offline"); });
  $("detPasses").innerHTML = `<p class="small">Working out passes…</p>`;
  setTimeout(() => { if (S.detailsId === id) renderDetailPasses(sat); }, 30);
}
function closeDetails() { S.detailsId = null; $("details").hidden = true; window.Model3D?.stop(); }
$("detBack").addEventListener("click", closeDetails);

function renderNow(sat) {
  $("detNowH").textContent = S.timeOffset ? `At ${dayWord(simNow())} ${fmtTime(simNow())}` : "Right now";
  const l = lookOne(sat, new Date(simNow()));
  if (!l) { $("detNow").innerHTML = rows([["Position", "Can't be worked out from the current data"]]); return; }
  const up = l.el != null && l.el > 0;
  $("detNow").innerHTML = rows([
    ["Where to look", l.el == null ? "Set your location first" : up ? `${compassName(l.az)} (${l.az.toFixed(0)}°), ${l.el.toFixed(0)}° above the horizon` : "Below your horizon"],
    ["Can you see it?", up ? visText(l.lit, l.mag).replace(/^./, c => c.toUpperCase()) : (l.lit ? "Sunlit, but below your horizon" : "No, it's in Earth's shadow")],
    ["Brightness", up && l.lit && l.mag != null ? `Magnitude ${l.mag.toFixed(1)}<span class="sub">${brightWord(l.mag)}. Estimated; lower is brighter.</span>` : null],
    ["Typical brightness", `Magnitude ${sat.m0.toFixed(1)}<span class="sub">At 1,000 km away and half lit, the standard for comparing satellites. ${MAG_SOURCE[sat.m0src] || ""}.</span>`],
    ["Distance from you", l.range != null ? fmtKm(l.range) : null],
    ["Height above Earth", fmtKm(l.alt)],
    ["Speed", `${l.speed.toFixed(2)} km/s <span class="sub">${Math.round(l.speed * 3600).toLocaleString("en")} km/h</span>`],
    ["Directly above", fmtLatLon(l.lat, l.lon)],
  ]);
}

function renderAbout(sat, state) {
  const op = operatorOf(sat), c = catMem.get(sat.id), d = intlDesig(sat.l1);
  const launch = c?.launch ? new Date(c.launch + "T00:00:00Z") : null;
  $("detAbout").innerHTML = rows([
    ["Operator", op?.op ? esc(op.op) : null],
    ["What it does", op?.role ? esc(op.role) : null],
    ["Owner (country or organization)", c ? esc(ownerName(c) || "Unknown") : null],
    ["Launched", launch ? `${fmtDate(launch)} <span class="sub">${ago(launch)}</span>` : (d ? `${d.year}` : null)],
    ["Launch site", c?.site ? esc(CODES.SITES[c.site] || c.site) : null],
    ["Object type", c?.type ? esc(CODES.TYPES[c.type] || c.type) : null],
    ["Status", c?.status ? esc(STATUS[c.status] || "Unknown") : null],
    ["Catalog", state === "loading" ? "Looking up owner and launch details…" : state === "offline" ? "Couldn't reach the satellite catalog. Check your connection and open this again." : null],
  ]);
}

function renderOrbit(sat) {
  const o = orbitInfo(sat);
  if (!o) { $("detOrbit").innerHTML = rows([["Orbit", "No usable orbit data"]]); return; }
  const height = Math.abs(o.apo - o.peri) < 40 ? `About ${fmtKm((o.apo + o.peri) / 2)}` : `${fmtKm(o.peri)} to ${fmtKm(o.apo)}`;
  const period = o.period >= 120 ? `${Math.floor(o.period / 60)} h ${Math.round(o.period % 60)} min` : `${o.period.toFixed(1)} minutes`;
  const reach = o.inc <= 90 ? o.inc : 180 - o.inc;
  const epoch = tleEpoch(sat.l1);
  $("detOrbit").innerHTML = rows([
    ["Orbit type", `${esc(o.cls)}<span class="sub">${esc(o.note)}</span>`],
    ["Height", height],
    ["Time for one orbit", `${period}<span class="sub">${o.perDay.toFixed(1)} orbits a day</span>`],
    ["Inclination", `${o.inc.toFixed(1)}°<span class="sub">${o.inc > 90 ? "Retrograde, " : ""}passes over latitudes up to ${reach.toFixed(0)}° N and S</span>`],
    ["Eccentricity", `${o.e.toFixed(4)}<span class="sub">0 is a perfect circle</span>`],
    ["Orbit data from", `${fmtDate(epoch)}<span class="sub">${ago(epoch)}</span>`],
  ]);
}

function renderDetailPasses(sat) {
  const box = $("detPasses");
  if (!S.loc) { box.innerHTML = `<p class="small">Set your location in Settings to see passes.</p>`; return; }
  const o = orbitInfo(sat);
  if (o && o.short === "GEO") {
    const l = lookOne(sat, new Date(simNow()));
    box.innerHTML = `<p class="small">${l && l.el > 0 ? `It stays at about ${l.el.toFixed(0)}° up in the ${compassName(l.az)} and doesn't rise or set. You'll need binoculars or a telescope to spot it.` : "It never rises above your horizon from where you are."}</p>`;
    return;
  }
  const list = passesFor(sat).filter(p => p.end > Date.now()).slice(0, 6);
  S.detailPasses = { sat, list };
  box.innerHTML = list.length ? `<p class="small">Tap a pass to follow it on the sky.</p>` + list.map((p, i) => `
    <button class="passrow ${p.visible ? "lit" : ""}" data-i="${i}">
      <span class="dot"></span>
      <span>${fmtDayTime(p.start)}<span class="sub">${compassName(p.startAz)} → ${compassName(p.endAz)} · peak ${p.maxEl.toFixed(0)}° at ${fmtTime(p.maxTime)}</span></span>
      <span class="num">${Math.max(1, Math.round((p.end - p.start) / 60000))} min<span class="sub">${p.visible ? `visible, ${magText(p.mag)}` : p.mag < 50 ? `too faint, ${magText(p.mag)}` : "not visible"}</span></span>
    </button>`).join("") : `<p class="small">No passes above 10° in the next 48 hours.</p>`;
}
$("detPasses").addEventListener("click", e => {
  const b = e.target.closest(".passrow"), d = S.detailPasses;
  if (b && d && d.list[+b.dataset.i]) watchPass(d.sat, d.list[+b.dataset.i]);
});
