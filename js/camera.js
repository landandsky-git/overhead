// Overhead: The camera picture behind the sky chart.
// One of the app's script files; index.html loads them in order and they share top-level names.
"use strict";

// The drawn sky only lines up with the picture when its zoom matches the camera's field of view,
// which differs between phones. So in camera view you pinch until the drawn stars sit on the real
// ones; that zoom is remembered separately from the normal one.
const CAM = { on: false, vfov: store.get("camVfov", 62), normalVfov: VFOV.normal };
async function toggleCamera() {
  if (CAM.on) {
    CAM.on = false; CAM.vfov = S.vfov; store.set("camVfov", CAM.vfov);
    if (!ALIGN.on) stopCamera();
    setZoom(CAM.normalVfov);
  } else {
    if (S.mode !== "sensor") { showHint(tl("The camera view needs the motion sensors: tap the phone button on the right first.", "Die Kameraansicht braucht die Bewegungssensoren: Tippe zuerst rechts auf die Handy-Taste.", "Камерний режим потребує датчиків руху: спершу торкнися кнопки з телефоном праворуч."), 6000); return; }
    if (!(await startCamera())) { showHint(tl("The camera isn't available. Allow camera access for this site in your browser settings.", "Die Kamera ist nicht verfügbar. Erlaube den Kamerazugriff für diese Seite in den Browser-Einstellungen.", "Камера недоступна. Дозволь доступ до камери для цього сайту в налаштуваннях браузера."), 6000); return; }
    CAM.on = true; CAM.normalVfov = S.vfov;
    setZoom(CAM.vfov);
    if (!store.get("camTipSeen", false)) {
      store.set("camTipSeen", true);
      showHint(tl("Pinch until the drawn stars sit on the real ones in the picture. The app remembers it for next time.", "Zoome mit zwei Fingern, bis die gezeichneten Sterne auf den echten im Bild sitzen. Die App merkt sich das für das nächste Mal.", "Зведи або розведи пальці, доки намальовані зорі не збігатимуться зі справжніми на зображенні. Застосунок запам’ятає це на наступний раз."), 9000);
    }
  }
  $("camBtn").setAttribute("aria-pressed", CAM.on);
}
$("camBtn").addEventListener("click", toggleCamera);
