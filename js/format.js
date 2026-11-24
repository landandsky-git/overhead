// Overhead: Formatting times, distances and dates.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// ---------- formatting ----------
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
const fmtKm = x => `${Math.round(x).toLocaleString("en")} km`;
const fmtTime = ms => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function dayWord(ms) {
  const d = new Date(ms), a = new Date(d), b = new Date();
  a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
  const n = Math.round((a - b) / 86400e3);
  return n === 0 ? "today" : n === 1 ? "tomorrow" : d.toLocaleDateString("en", { weekday: "short" });
}
const fmtDayTime = ms => `${dayWord(ms)} ${fmtTime(ms)}`;
function fmtLatLon(lat, lon) { return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`; }
function ago(date) {
  const days = (Date.now() - date) / 86400e3;
  if (days < 1) return "today";
  if (days < 60) return `${Math.round(days)} day${Math.round(days) === 1 ? "" : "s"} ago`;
  if (days < 730) return `${Math.round(days / 30.4)} months ago`;
  return `${Math.floor(days / 365.25)} years ago`;
}
const fmtDate = d => d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
function visText(lit, mag) {
  if (!lit) return "in Earth's shadow, so you can't see it";
  if (sky.sunEl >= -6) return "sunlit, but your sky is still bright";
  return mag != null ? `magnitude ${mag.toFixed(1)}, ${brightWord(mag)}` : "sunlit";
}
const magText = m => m != null && m < 50 ? `mag ${m.toFixed(1)}` : "";
const rows = list => list.filter(r => r && r[1] != null && r[1] !== "").map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("");
