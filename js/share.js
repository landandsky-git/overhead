// Overhead: Sharing a pass through the phone's share menu (or copying it).
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

function passShareText(p) {
  const name = p.count > 1 ? tl(`A Starlink train (${p.count} satellites)`, `Eine Starlink-Kette (${p.count} Satelliten)`, `Потяг Starlink (${p.count} ${ukPlural(p.count, "супутник", "супутники", "супутників")})`) : p.sat.name;
  const town = placeName(S.loc), where = town ? tl(` over ${town}`, ` über ${town}`, `, ${town},`) : "";
  const [rise, top, set] = [p.startAz, p.maxAz, p.endAz].map(compassName), el = p.maxEl.toFixed(0);
  const bright = p.mag < 50 ? tl(`. Brightness about magnitude ${fmtN(p.mag, 1)}, ${brightWord(p.mag, p.limit).split(",")[0]}.`, `. Helligkeit etwa Magnitude ${fmtN(p.mag, 1)}, ${brightWord(p.mag, p.limit).split(",")[0]}.`, `. Яскравість близько ${fmtN(p.mag, 1)} зв. вел., ${brightWord(p.mag, p.limit).split(",")[0]}.`) : ".";
  return tl(`${name}${where} ${dayWord(p.start)} at ${fmtTime(p.start)}: rises in the ${rise}, highest ${el}° in the ${top} at ${fmtTime(p.maxTime)}, gone in the ${set} by ${fmtTime(p.end)}${bright}`,
            `${name}${where} ${dayWord(p.start)} um ${fmtTime(p.start)}: geht im ${rise} auf, am höchsten ${el}° im ${top} um ${fmtTime(p.maxTime)}, verschwindet bis ${fmtTime(p.end)} im ${set}${bright}`,
            `${name}${where} ${dayWord(p.start)} о ${fmtTime(p.start)}: сходить на ${rise}, найвище ${el}° на ${top} о ${fmtTime(p.maxTime)}, зникає на ${set} до ${fmtTime(p.end)}${bright}`);
}
// The link opens the app with this satellite selected (main.js reads #sat=).
async function sharePass(p) {
  const text = passShareText(p), url = `${location.origin}${location.pathname}#sat=${p.sat.id}`;
  if (navigator.share) {
    try { await navigator.share({ title: tl("Satellite pass", "Satellitenüberflug", "Проліт супутника"), text, url }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(`${text} ${url}`); showHint(tl("Copied. Paste it into a message to share it.", "Kopiert. Füge es in eine Nachricht ein, um es zu teilen.", "Скопійовано. Встав у повідомлення, щоб поділитися."), 5000); }
  catch { showHint(text, 12000); }
}
$("cardShare").addEventListener("click", e => { e.stopPropagation(); if (WATCH.pass) sharePass({ ...WATCH.pass, sat: WATCH.sat }); });
