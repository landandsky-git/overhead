// Overhead: Language: English or German.
// One of the app's script files; index.html loads them in order and they share top-level names.
// This one loads first, so every other file can use tl().
"use strict";

// The app follows the phone's language unless one is chosen in Settings ("lang": "auto", "en" or
// "de"). Changing it reloads the app, so the language never changes while the app is running.
const LANG = (() => {
  let pref = "auto";
  try { pref = JSON.parse(localStorage.getItem("lang")) || "auto"; } catch {}
  if (pref === "en" || pref === "de") return pref;
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const langs = nav ? (nav.languages && nav.languages.length ? nav.languages : [nav.language || "en"]) : ["en"];
  for (const l of langs) { const k = String(l).slice(0, 2).toLowerCase(); if (k === "de" || k === "en") return k; }
  return "en";
})();
// Text in the code is written in both languages side by side: tl("Settings", "Einstellungen").
const tl = (en, de) => LANG === "de" && de != null ? de : en;
const NUM_LOCALE = tl("en", "de-DE");   // 17,027 and 2.5 / 17.027 and 2,5
// A number with a fixed number of decimals, written the local way.
const fmtN = (x, d = 0) => Number(x).toLocaleString(NUM_LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d });
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// Names in the sky that differ in German. The app keeps the English names inside (the checks and
// the align list use them) and only shows these.
const SKY_NAMES_DE = {
  Moon: "Mond", Mercury: "Merkur", Vega: "Wega", Arcturus: "Arktur", Betelgeuse: "Beteigeuze", Altair: "Atair",
  Capella: "Kapella", Procyon: "Prokyon", Spica: "Spika", Polaris: "Polarstern", Castor: "Kastor",
};
const skyName = name => LANG === "de" ? SKY_NAMES_DE[name] || name : name;

// The page's own text: elements carry their German in data-de (text) and data-de-title,
// data-de-aria-label, data-de-placeholder (attributes).
(function applyLanguage() {
  if (LANG !== "de" || typeof document === "undefined" || !document.querySelectorAll) return;
  document.documentElement.lang = "de";
  for (const el of document.querySelectorAll("[data-de]")) el.textContent = el.dataset.de;
  for (const attr of ["title", "aria-label", "placeholder"]) {
    for (const el of document.querySelectorAll(`[data-de-${attr}]`)) el.setAttribute(attr, el.getAttribute(`data-de-${attr}`));
  }
})();
