// Overhead: Full-screen panels (intro, settings, satellite details, quick guide) behave as dialogs.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// While a panel is open, focus moves into it and everything behind it is inert (out of reach of
// Tab and screen readers), so keyboard and screen-reader users stay inside. Escape closes the top
// panel, and focus goes back to where it was before. The spoken status lines stay live.
const LAYERS = [];   // open panels, topmost last: { el, close, back }
function openLayer(el, close, focusEl) {
  if (!LAYERS.some(l => l.el === el)) LAYERS.push({ el, close, back: document.activeElement });
  syncInert();
  if (focusEl) focusEl.focus({ preventScroll: true });
}
function closeLayer(el) {
  const i = LAYERS.findIndex(l => l.el === el);
  if (i < 0) return;
  const [layer] = LAYERS.splice(i, 1);
  syncInert();
  const back = layer.back;
  if (back && back !== document.body && back.isConnected && !back.closest("[inert], [hidden]")) back.focus({ preventScroll: true });
}
function syncInert() {
  const top = LAYERS.length ? LAYERS[LAYERS.length - 1].el : null;
  for (const el of document.body.children) {
    if (el.tagName === "SCRIPT" || el.id === "hint" || el.id === "notice") continue;
    el.inert = !!top && el !== top;
  }
}

// Escape: closes the top panel; without one, the align or identify bar, the time bar, then the list.
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || e.defaultPrevented) return;
  const top = LAYERS[LAYERS.length - 1];
  if (top) { if (top.close) { e.preventDefault(); top.close(); } return; }
  if (ALIGN.on) closeAlign();
  else if (IDENT.on) closeIdentify();
  else if (!$("timeBar").hidden) closeTimeBar();
  else if ($("sheet").classList.contains("open")) setSheetOpen(false);
  else return;
  e.preventDefault();
});
