// Overhead: Language: English, German or Ukrainian.
// One of the app's script files; index.html loads them in order and they share top-level names.
// This one loads first, so every other file can use tl().
"use strict";

// The app follows the phone's language unless one is chosen in Settings ("lang": "auto", "en", "de"
// or "uk"). Changing it reloads the app, so the language never changes while the app is running.
const LANGS = ["en", "de", "uk"];
const LANG = (() => {
  let pref = "auto";
  try { pref = JSON.parse(localStorage.getItem("lang")) || "auto"; } catch {}
  if (LANGS.includes(pref)) return pref;
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const langs = nav ? (nav.languages && nav.languages.length ? nav.languages : [nav.language || "en"]) : ["en"];
  for (const l of langs) { const k = String(l).slice(0, 2).toLowerCase(); if (LANGS.includes(k)) return k; }
  return "en";
})();
// Text in the code is written in all three languages side by side: tl("Settings", "Einstellungen", "Налаштування").
// A missing translation falls back to English.
const tl = (en, de, uk) => (LANG === "de" && de != null ? de : LANG === "uk" && uk != null ? uk : en);
const NUM_LOCALE = tl("en", "de-DE", "uk-UA");   // 17,027 and 2.5 / 17.027 and 2,5 / 17 027 and 2,5
// A number with a fixed number of decimals, written the local way.
const fmtN = (x, d = 0) => Number(x).toLocaleString(NUM_LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d });
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
// Ukrainian nouns after a number: 1, 21, 31… супутник; 2–4, 22–24… супутники; 5–20, 25–30… супутників.
const ukPlural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };

// Names in the sky that differ in German or Ukrainian. The app keeps the English (and Latin) names
// inside (the checks and the align list use them) and only shows these.
const SKY_NAMES = {
  de: { Moon: "Mond", Mercury: "Merkur", Vega: "Wega", Arcturus: "Arktur", Betelgeuse: "Beteigeuze", Altair: "Atair",
        Capella: "Kapella", Procyon: "Prokyon", Spica: "Spika", Polaris: "Polarstern", Castor: "Kastor" },
  uk: { Moon: "Місяць", Mercury: "Меркурій", Venus: "Венера", Mars: "Марс", Jupiter: "Юпітер", Saturn: "Сатурн",
        Sirius: "Сіріус", Canopus: "Канопус", Arcturus: "Арктур", "Rigil Kentaurus": "Рігіль Кентаврус", Vega: "Вега", Capella: "Капелла",
        Rigel: "Рігель", Procyon: "Проціон", Achernar: "Ахернар", Betelgeuse: "Бетельгейзе", Hadar: "Хадар", Altair: "Альтаїр",
        Acrux: "Акрукс", Aldebaran: "Альдебаран", Spica: "Спіка", Antares: "Антарес", Pollux: "Поллукс", Fomalhaut: "Фомальгаут",
        Mimosa: "Мімоза", Deneb: "Денеб", Regulus: "Регул", Adhara: "Адара", Castor: "Кастор", Shaula: "Шаула", Bellatrix: "Беллатрикс",
        Elnath: "Ельнат", Alnilam: "Альнілам", Alnitak: "Альнітак", Alioth: "Аліот", Mirfak: "Мірфак", Dubhe: "Дубге", Alkaid: "Алькаїд",
        Polaris: "Полярна", Mintaka: "Мінтака", Saiph: "Саїф", Algol: "Алголь", Mizar: "Міцар", Alhena: "Альхена", Denebola: "Денебола",
        Alphard: "Альфард", Hamal: "Гамаль", Diphda: "Діфда", Kochab: "Кохаб", Alpheratz: "Альферац", Mirach: "Мірах", Almach: "Аламак",
        Rasalhague: "Расальхаге", Enif: "Еніф", Markab: "Маркаб", Scheat: "Шеат", Albireo: "Альбірео", Sadr: "Садр", Pleiades: "Плеяди" },
};
// Constellation names in Ukrainian (the sky data has the Latin ones, which German star charts use too).
const CONSTELLATIONS_UK = {
  Andromeda: "Андромеда", Antlia: "Насос", Apus: "Райський Птах", Aquarius: "Водолій", Aquila: "Орел", Ara: "Жертовник", Aries: "Овен",
  Auriga: "Візничий", "Boötes": "Волопас", Bootes: "Волопас", Caelum: "Різець", Camelopardalis: "Жираф", Cancer: "Рак", "Canes Venatici": "Гончі Пси",
  "Canis Major": "Великий Пес", "Canis Minor": "Малий Пес", Capricornus: "Козеріг", Carina: "Кіль", Cassiopeia: "Кассіопея", Centaurus: "Центавр",
  Cepheus: "Цефей", Cetus: "Кит", Chamaeleon: "Хамелеон", Circinus: "Циркуль", Columba: "Голуб", "Coma Berenices": "Волосся Вероніки",
  "Corona Australis": "Південна Корона", "Corona Borealis": "Північна Корона", Corvus: "Ворон", Crater: "Чаша", Crux: "Південний Хрест",
  Cygnus: "Лебідь", Delphinus: "Дельфін", Dorado: "Золота Риба", Draco: "Дракон", Equuleus: "Малий Кінь", Eridanus: "Ерідан", Fornax: "Піч",
  Gemini: "Близнята", Grus: "Журавель", Hercules: "Геркулес", Horologium: "Годинник", Hydra: "Гідра", Hydrus: "Південна Гідра", Indus: "Індіанець",
  Lacerta: "Ящірка", Leo: "Лев", "Leo Minor": "Малий Лев", Lepus: "Заєць", Libra: "Терези", Lupus: "Вовк", Lynx: "Рись", Lyra: "Ліра",
  Mensa: "Столова Гора", Microscopium: "Мікроскоп", Monoceros: "Єдиноріг", Musca: "Муха", Norma: "Косинець", Octans: "Октант",
  Ophiuchus: "Змієносець", Orion: "Оріон", Pavo: "Павич", Pegasus: "Пегас", Perseus: "Персей", Phoenix: "Фенікс", Pictor: "Живописець",
  Pisces: "Риби", "Piscis Austrinus": "Південна Риба", Puppis: "Корма", Pyxis: "Компас", Reticulum: "Сітка", Sagitta: "Стріла",
  Sagittarius: "Стрілець", Scorpius: "Скорпіон", Sculptor: "Скульптор", Scutum: "Щит", Serpens: "Змія", Sextans: "Секстант", Taurus: "Телець",
  Telescopium: "Телескоп", Triangulum: "Трикутник", "Triangulum Australe": "Південний Трикутник", Tucana: "Тукан", "Ursa Major": "Велика Ведмедиця",
  "Ursa Minor": "Мала Ведмедиця", Vela: "Вітрила", Virgo: "Діва", Volans: "Летюча Риба", Vulpecula: "Лисичка",
};
const skyName = name => (SKY_NAMES[LANG] && SKY_NAMES[LANG][name]) || name;
const constellationName = name => (LANG === "uk" && CONSTELLATIONS_UK[name]) || name;

// The page's own text: elements carry their translations in data-de / data-uk (text) and
// data-de-title, data-uk-aria-label, … (attributes).
(function applyLanguage() {
  if (LANG === "en" || typeof document === "undefined" || !document.querySelectorAll) return;
  document.documentElement.lang = LANG;
  for (const el of document.querySelectorAll(`[data-${LANG}]`)) el.textContent = el.getAttribute(`data-${LANG}`);
  for (const attr of ["title", "aria-label", "placeholder"]) {
    for (const el of document.querySelectorAll(`[data-${LANG}-${attr}]`)) el.setAttribute(attr, el.getAttribute(`data-${LANG}-${attr}`));
  }
})();
