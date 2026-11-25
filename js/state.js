// Overhead: Shared helpers and app state.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const CODES = window.SAT_CODES || { OWNERS: {}, SITES: {}, TYPES: {}, OPERATORS: [] };
try { localStorage.removeItem("tle"); } catch {}   // satellite data now lives in the Cache API

// ---------- state ----------
const S = {
  loc: store.get("loc", null),          // {lat, lon, h, name, src: "search" | "gps" | "manual"}
  corr: store.get("corr", 0),
  show: Object.assign({ bright: true, starlink: true, other: true }, store.get("show", {})),
  eyeOnly: store.get("eyeOnly", false),
  limit: store.get("limit", 4.5),
  battery: store.get("battery", true),   // redraw less often while the phone is still
  favs: new Set(store.get("favs", ["25544", "48274", "20580"])),   // favourite satellites: ISS, Tiangong, Hubble to start       // faintest magnitude visible from the viewer's sky (see SKY_LIMITS)
  timeOffset: 0,                        // ms the time slider moves the sky away from now
  sats: [], byId: new Map(), counts: { bright: 0, starlink: 0, other: 0 }, trains: new Map(),
  gen: 0, now: [], nowMap: new Map(),   // positions from the worker: idx -> {sat, az, el, range, lit, v}
  targetId: store.get("target", null),
  mode: null, R: null, view: { az: 180, el: 22 }, vfov: 70,
  passes: null, passesAt: 0, passJob: 0,
  tab: "now", lastSensor: 0, anyEvent: false,
  tleTime: 0, times: [], loading: tl("Loading satellites…", "Satelliten werden geladen…", "Завантаження супутників…"), detailsId: null,
};
// The moment the sky is drawn for: now, or now moved by the time slider. Pass predictions,
// countdowns and data ages keep using the real clock.
const simNow = () => Date.now() + S.timeOffset;
// A place found by GPS has no town name; it's shown as "Your GPS location" in the app's language.
const GPS_NAME = tl("Your GPS location", "Dein GPS-Standort", "Твоє GPS-місцезнаходження");
const locName = loc => loc && (loc.src === "gps" ? GPS_NAME : loc.name);
const placeName = loc => loc && loc.src !== "gps" && loc.name ? loc.name.split(",")[0] : null;   // the town, for sharing
const CAT_LABEL = { bright: tl("Bright / easy to see", "Hell / gut sichtbar", "Яскравий / добре видно"), starlink: "Starlink", other: tl("Active satellite", "Aktiver Satellit", "Активний супутник") };
// Lining the sky up on a real star or planet: on = panel open, camera = live camera picture behind
// the sky, edge = no camera, so the top edge of the phone is used as the pointer.
const ALIGN = { on: false, camera: false, edge: false, stream: null, timer: 0, key: "" };
