# Builds data/comets.json: the orbits of comets that should be brighter than magnitude 10 at some
# point in the next 60 days, from NASA JPL's Small-Body Database. The app then works out where
# they are on the sky and how bright (total magnitude M1 + 5 log delta + K1 log r). Run daily by the
# GitHub workflow, so phones don't each ask JPL.
# Usage: python3 tools/build-comets.py data/comets.json
import json, math, sys, urllib.parse, urllib.request
from datetime import datetime, timezone

API = "https://ssd-api.jpl.nasa.gov/sbdb_query.api"
K = 0.01720209895          # radians a day for 1 AU around the Sun
DAYS, LIMIT, KEEP = 60, 10.0, 15


def fetch():
    q = urllib.parse.urlencode({"fields": "full_name,e,q,i,om,w,tp,M1,K1", "sb-kind": "c",
                                "sb-cdata": json.dumps({"AND": ["M1|LT|16", "q|LT|5"]})})
    req = urllib.request.Request(f"{API}?{q}", headers={"User-Agent": "Overhead satellite app"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def kepler_xyz(r, nu, om, w, i):
    O, u, I = math.radians(om), math.radians(w) + nu, math.radians(i)
    return (r * (math.cos(O) * math.cos(u) - math.sin(O) * math.sin(u) * math.cos(I)),
            r * (math.sin(O) * math.cos(u) + math.cos(O) * math.sin(u) * math.cos(I)),
            r * math.sin(u) * math.sin(I))


def comet_helio(c, jd):   # the same orbit solution as the app (js/skyguide.js)
    dt, q, e = jd - c["tp"], c["q"], c["e"]
    if abs(e - 1) < 1e-4:
        W = 3 * K / math.sqrt(2 * q ** 3) * dt
        Y = (W / 2 + math.sqrt(W * W / 4 + 1)) ** (1 / 3)
        s = Y - 1 / Y
        nu, r = 2 * math.atan(s), q * (1 + s * s)
    elif e < 1:
        a = q / (1 - e)
        M = math.remainder(K / a ** 1.5 * dt, 2 * math.pi)
        E = (math.pi if M >= 0 else -math.pi) if e > 0.8 else M
        for _ in range(50):
            d = (E - e * math.sin(E) - M) / (1 - e * math.cos(E))
            E -= d
            if abs(d) < 1e-12:
                break
        nu = 2 * math.atan2(math.sqrt(1 + e) * math.sin(E / 2), math.sqrt(1 - e) * math.cos(E / 2))
        r = a * (1 - e * math.cos(E))
    else:
        a = q / (e - 1)
        M = K / a ** 1.5 * dt
        H = math.asinh(M / e)
        for _ in range(60):
            d = (e * math.sinh(H) - H - M) / (e * math.cosh(H) - 1)
            H -= d
            if abs(d) < 1e-12:
                break
        nu = 2 * math.atan(math.sqrt((e + 1) / (e - 1)) * math.tanh(H / 2))
        r = a * (e * math.cosh(H) - 1)
    return r, kepler_xyz(r, nu, c["om"], c["w"], c["i"])


def earth_helio(jd):      # JPL's approximate elements for the Earth-Moon barycentre, as in the app
    T = (jd - 2451545) / 36525
    a, e, inc = 1.00000261 + 0.00000562 * T, 0.01671123 - 0.00004392 * T, -0.00001531 - 0.01294668 * T
    L, peri = 100.46457166 + 35999.37244981 * T, 102.93768193 + 0.32327364 * T
    M = math.radians(((L - peri) % 360 + 540) % 360 - 180)
    E = M + e * math.sin(M)
    for _ in range(6):
        E -= (E - e * math.sin(E) - M) / (1 - e * math.cos(E))
    xp, yp = a * (math.cos(E) - e), a * math.sqrt(1 - e * e) * math.sin(E)
    w, I = math.radians(peri), math.radians(inc)
    return (math.cos(w) * xp - math.sin(w) * yp, math.sin(w) * xp + math.cos(w) * yp, 0.0 * I)


def magnitude(c, jd):
    r, (x, y, z) = comet_helio(c, jd)
    ex, ey, ez = earth_helio(jd)
    delta = math.dist((x, y, z), (ex, ey, ez))
    return c["M1"] + 5 * math.log10(delta) + c["K1"] * math.log10(r)


out = sys.argv[1] if len(sys.argv) > 1 else "data/comets.json"
res = fetch()
idx = {f: k for k, f in enumerate(res["fields"])}
now = datetime.now(timezone.utc)
jd0 = now.timestamp() / 86400 + 2440587.5
found = []
for row in res.get("data", []):
    try:
        c = {k: float(row[idx[k]]) for k in ("e", "q", "i", "om", "w", "tp", "M1", "K1")}
    except (TypeError, ValueError):
        continue                      # no orbit or no brightness parameters
    if abs(c["tp"] - jd0) > 3 * 365:   # long past or far from the Sun now
        continue
    best = min((magnitude(c, jd0 + d), d) for d in range(0, DAYS + 1, 2))
    if best[0] <= LIMIT:
        c["name"] = row[idx["full_name"]].strip()
        c["best"] = {"mag": round(best[0], 1), "days": best[1]}
        found.append(c)
found.sort(key=lambda c: c["best"]["mag"])
data = {"updated": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "source": "NASA JPL Small-Body Database",
        "comets": [{k: (round(v, 7) if isinstance(v, float) else v) for k, v in c.items()} for c in found[:KEEP]]}
with open(out, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
print(f"comets.json: {len(data['comets'])} comets brighter than {LIMIT} in the next {DAYS} days" +
      "".join(f"\n  {c['name']}: mag {c['best']['mag']} in {c['best']['days']} days" for c in data["comets"]))
