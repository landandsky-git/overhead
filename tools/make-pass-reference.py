# Makes tests/pass-reference.js: ISS passes over Rastatt worked out by Skyfield, an independent
# astronomy library, for the same orbit the automatic checks use. tests/checks.js compares the app's
# own pass predictions with these, so a mistake in the app's pass maths stops the site from being
# published. Only needs running again if the test orbit or place changes.
# Usage: pip install skyfield; python tools/make-pass-reference.py tests/pass-reference.js
import json, sys
from skyfield.api import EarthSatellite, load, wgs84

L1 = "1 25544U 98067A   26303.46683196  .00007083  00000+0  13602-3 0  9999"
L2 = "2 25544  51.6332 350.6604 0007060 327.9433  32.1125 15.49116094592729"
PLACE = {"lat": 48.8585, "lon": 8.2033, "h": 120}
START, HOURS = "2026-10-30T12:00:00Z", 48

ts = load.timescale()
sat = EarthSatellite(L1, L2, "ISS (ZARYA)", ts)
here = wgs84.latlon(PLACE["lat"], PLACE["lon"], elevation_m=PLACE["h"])
t0 = ts.from_datetime(__import__("datetime").datetime.fromisoformat(START.replace("Z", "+00:00")))
t1 = t0 + HOURS / 24
times, events = sat.find_events(here, t0, t1, altitude_degrees=0.0)

passes, cur = [], None
for t, ev in zip(times, events):
    if ev == 0:
        cur = {"rise": t}
    elif ev == 1 and cur is not None:
        alt = (sat - here).at(t).altaz()[0].degrees
        cur.update(max=t, maxEl=alt)
    elif ev == 2 and cur is not None and "max" in cur:
        cur["set"] = t
        if cur["maxEl"] >= 10:      # the app lists passes higher than 10°
            passes.append(cur)
        cur = None

ms = lambda t: round(t.utc_datetime().timestamp() * 1000)
ref = {"source": "Skyfield " + __import__("skyfield").__version__, "l1": L1, "l2": L2, "place": PLACE, "start": START, "hours": HOURS,
       "passes": [{"rise": ms(p["rise"]), "max": ms(p["max"]), "maxEl": round(p["maxEl"], 2), "set": ms(p["set"])} for p in passes]}
with open(sys.argv[1] if len(sys.argv) > 1 else "tests/pass-reference.js", "w", encoding="utf-8", newline="\n") as f:
    f.write("// ISS passes over Rastatt worked out by Skyfield (made by tools/make-pass-reference.py); see tests/checks.js.\n")
    f.write("var PASS_REFERENCE = " + json.dumps(ref, indent=1) + ";\n")
print(f"{len(passes)} passes:", ", ".join(f"{p['rise'].utc_strftime('%d %H:%M:%S')} max {p['maxEl']:.1f}°" for p in passes))
