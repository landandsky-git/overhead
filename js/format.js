// Overhead: Formatting times, distances and dates.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// ---------- formatting ----------
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
const fmtKm = x => `${fmtN(Math.round(x))} km`;
// Times follow the phone's own 12/24-hour setting in English; German always uses 24 hours.
const fmtTime = ms => new Date(ms).toLocaleTimeString(tl([], "de-DE"), { hour: "numeric", minute: "2-digit" });
function dayWord(ms) {
  const d = new Date(ms), a = new Date(d), b = new Date();
  a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
  const n = Math.round((a - b) / 86400e3);
  return n === 0 ? tl("today", "heute") : n === 1 ? tl("tomorrow", "morgen") : d.toLocaleDateString(tl("en", "de-DE"), { weekday: "short" });
}
const fmtDayTime = ms => `${dayWord(ms)} ${fmtTime(ms)}`;
function fmtLatLon(lat, lon) {
  return tl(`${fmtN(Math.abs(lat), 2)}°${lat >= 0 ? "N" : "S"} ${fmtN(Math.abs(lon), 2)}°${lon >= 0 ? "E" : "W"}`,
            `${fmtN(Math.abs(lat), 2)}° ${lat >= 0 ? "N" : "S"} ${fmtN(Math.abs(lon), 2)}° ${lon >= 0 ? "O" : "W"}`);
}
function ago(date) {
  const days = (Date.now() - date) / 86400e3, n = Math.round(days);
  if (days < 1) return tl("today", "heute");
  if (days < 60) return tl(`${n} day${n === 1 ? "" : "s"} ago`, `vor ${n} Tag${n === 1 ? "" : "en"}`);
  if (days < 730) return tl(`${Math.round(days / 30.4)} months ago`, `vor ${Math.round(days / 30.4)} Monaten`);
  return tl(`${Math.floor(days / 365.25)} years ago`, `vor ${Math.floor(days / 365.25)} Jahren`);
}
const fmtDate = d => d.toLocaleDateString(tl("en-GB", "de-DE"), { year: "numeric", month: "short", day: "numeric" });
function visText(lit, mag) {
  if (!lit) return tl("in Earth's shadow, so you can't see it", "im Erdschatten, daher nicht zu sehen");
  if (sky.sunEl >= -6) return tl("sunlit, but your sky is still bright", "angestrahlt, aber dein Himmel ist noch hell");
  return mag != null ? `${tl("magnitude", "Magnitude")} ${fmtN(mag, 1)}, ${brightWord(mag)}` : tl("sunlit", "angestrahlt");
}
const magText = m => m != null && m < 50 ? `mag ${fmtN(m, 1)}` : "";
const rows = list => list.filter(r => r && r[1] != null && r[1] !== "").map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("");
